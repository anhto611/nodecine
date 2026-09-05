/**
 * Server handler for `github-showcase/fetch-repo` (spec §2.4, ARCHITECTURE §5).
 *
 * Only the owner/name pair leaves the client; every outbound URL is rebuilt here against fixed
 * GitHub hosts, so a shared graph cannot make this machine call anywhere else. Anonymous
 * requests are rate-limited per IP; `GITHUB_TOKEN` (optional) raises the limit.
 */
import { z } from 'zod';
import { NodeError } from '@/core/errors';
import { GithubErrorCode } from '@/nodes/github/errors';
import type { RepoData } from '@/nodes/github/facts';

const Coords = z.object({
  owner: z.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/),
  name: z.string().regex(/^[A-Za-z0-9._-]{1,100}$/).refine((n) => n !== '.' && n !== '..'),
});

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';
const MANIFESTS = ['package.json', 'pyproject.toml', 'go.mod', 'Cargo.toml'] as const;
const MAX_MANIFEST_BYTES = 200_000;
const MAX_README_BYTES = 400_000;

export interface FetchDeps {
  fetch: typeof fetch;
  token?: string;
  timeoutMs: number;
  retries: number;
  /** Delay between retries; tests pass 0. */
  backoffMs: number;
}

const defaultDeps = (): FetchDeps => ({
  fetch: globalThis.fetch,
  token: process.env.GITHUB_TOKEN || undefined,
  timeoutMs: 15_000,
  retries: 3,
  backoffMs: 600,
});

function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error('timeout')), ms);
  signal?.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true });
  ctrl.signal.addEventListener('abort', () => clearTimeout(t), { once: true });
  return ctrl.signal;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET with GitHub headers; retries transient failures; maps 404 and rate limits to the fetcher's error codes. */
async function get(url: string, deps: FetchDeps, signal: AbortSignal | undefined, accept: string): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= deps.retries; attempt++) {
    if (signal?.aborted) throw new NodeError('RUN_CANCELLED', 'cancelled');
    try {
      const res = await deps.fetch(url, {
        headers: {
          Accept: accept,
          'User-Agent': 'nodecine',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(deps.token ? { Authorization: `Bearer ${deps.token}` } : {}),
        },
        signal: withTimeout(signal, deps.timeoutMs),
      });
      if (res.status === 404) throw new NodeError(GithubErrorCode.REPO_NOT_FOUND, `no public repository at ${url.replace(API, '')}`);
      if ((res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0') {
        const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
        const at = Number.isFinite(reset) && reset > 0 ? new Date(reset).toISOString() : undefined;
        throw new NodeError(GithubErrorCode.REPO_RATE_LIMITED, `GitHub API rate limit exceeded${at ? `, resets at ${at}` : ''}`, true, { resetAt: at });
      }
      if (res.status >= 500) throw new Error(`GitHub responded ${res.status}`);
      return res;
    } catch (e) {
      if (e instanceof NodeError) throw e; // not transient
      lastErr = e;
      if (signal?.aborted) throw new NodeError('RUN_CANCELLED', 'cancelled');
      // GitHub answers 5xx in bursts; back off a little longer each time.
      if (attempt < deps.retries) await sleep(deps.backoffMs * 2 ** attempt);
    }
  }
  throw new NodeError(GithubErrorCode.REPO_NETWORK, `could not reach GitHub: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`, true);
}

async function readCapped(res: Response, max: number): Promise<string> {
  const text = await res.text();
  return text.length > max ? text.slice(0, max) : text;
}

export async function fetchRepo(input: unknown, signal?: AbortSignal, deps: FetchDeps = defaultDeps()): Promise<RepoData> {
  const parsed = Coords.safeParse(input);
  if (!parsed.success) throw new NodeError(GithubErrorCode.REPO_NOT_FOUND, 'invalid repository coordinates');
  const { owner, name } = parsed.data;
  const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;

  const repoRes = await get(base, deps, signal, 'application/vnd.github+json');
  const repo = (await repoRes.json()) as {
    description?: string | null;
    stargazers_count?: number;
    topics?: string[];
    language?: string | null;
    default_branch?: string;
    owner?: { login?: string };
    name?: string;
  };
  const defaultBranch = repo.default_branch || 'main';
  // GitHub may canonicalise casing or follow a rename; keep what it reports.
  const canonOwner = repo.owner?.login || owner;
  const canonName = repo.name || name;

  // README (raw) and root listing are best-effort: a repo without either still yields facts.
  // The repository itself answered, so from here on a missing or failing piece degrades the facts
  // instead of failing the node: a 404 means the repo has no README; a 5xx that survived the retries
  // is GitHub having a bad minute. Only a cancel or an exhausted rate limit still propagates.
  const degraded: string[] = [];
  const bestEffort = (what: string, e: unknown): void => {
    if (e instanceof NodeError && (e.code === 'RUN_CANCELLED' || e.code === GithubErrorCode.REPO_RATE_LIMITED)) throw e;
    if (!(e instanceof NodeError && e.code === GithubErrorCode.REPO_NOT_FOUND)) degraded.push(`${what}: ${e instanceof Error ? e.message : String(e)}`);
  };

  let readme = '';
  try {
    const r = await get(`${base}/readme`, deps, signal, 'application/vnd.github.raw+json');
    readme = await readCapped(r, MAX_README_BYTES);
  } catch (e) {
    bestEffort('README', e);
  }

  let rootFiles: string[] = [];
  try {
    const t = await get(`${base}/git/trees/${encodeURIComponent(defaultBranch)}`, deps, signal, 'application/vnd.github+json');
    const tree = (await t.json()) as { tree?: { path?: string; type?: string }[] };
    rootFiles = (tree.tree ?? []).filter((e) => e.type === 'blob' && typeof e.path === 'string').map((e) => e.path!);
  } catch (e) {
    bestEffort('root listing', e);
  }

  const manifests: RepoData['manifests'] = {};
  for (const file of MANIFESTS) {
    if (!rootFiles.includes(file)) continue;
    try {
      // raw.githubusercontent.com does not count against the API rate limit.
      const r = await get(`${RAW}/${encodeURIComponent(canonOwner)}/${encodeURIComponent(canonName)}/${encodeURIComponent(defaultBranch)}/${file}`, deps, signal, 'text/plain');
      manifests[file] = await readCapped(r, MAX_MANIFEST_BYTES);
    } catch (e) {
      bestEffort(file, e);
    }
  }

  return {
    owner: canonOwner,
    name: canonName,
    description: repo.description ?? null,
    stars: typeof repo.stargazers_count === 'number' ? repo.stargazers_count : null,
    topics: Array.isArray(repo.topics) ? repo.topics.filter((t): t is string => typeof t === 'string') : [],
    language: repo.language ?? null,
    defaultBranch,
    readme,
    rootFiles,
    manifests,
    ...(degraded.length ? { degraded } : {}),
  };
}
