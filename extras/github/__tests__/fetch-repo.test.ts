import { describe, expect, it } from 'vitest';
import { fetchRepo, type FetchDeps } from '../server/fetch-repo';

type Route = (url: string) => { status: number; body?: unknown; headers?: Record<string, string> };

function deps(route: Route, extra: Partial<FetchDeps> = {}): FetchDeps & { urls: string[] } {
  const urls: string[] = [];
  const fakeFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    const r = route(url);
    const body = typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? {});
    return new Response(body, { status: r.status, headers: r.headers });
  }) as unknown as typeof fetch;
  return { fetch: fakeFetch, timeoutMs: 1000, retries: 2, backoffMs: 0, urls, ...extra };
}

const okRoute: Route = (url) => {
  if (url === 'https://api.github.com/repos/acme/widget') return { status: 200, body: { description: 'A widget.', stargazers_count: 7, topics: ['x'], language: 'Rust', default_branch: 'trunk', owner: { login: 'acme' }, name: 'widget' } };
  if (url.endsWith('/readme')) return { status: 200, body: '# Widget\nHello' };
  if (url.includes('/git/trees/trunk')) return { status: 200, body: { tree: [{ path: 'Cargo.toml', type: 'blob' }, { path: 'src', type: 'tree' }] } };
  if (url === 'https://raw.githubusercontent.com/acme/widget/trunk/Cargo.toml') return { status: 200, body: '[package]\nname = "widget"\n' };
  return { status: 404 };
};

describe('fetchRepo (server handler)', () => {
  it('rebuilds every URL from owner/name against fixed GitHub hosts', async () => {
    const d = deps(okRoute);
    const data = await fetchRepo({ owner: 'acme', name: 'widget' }, undefined, d);
    expect(data).toMatchObject({ owner: 'acme', name: 'widget', stars: 7, language: 'Rust', defaultBranch: 'trunk', readme: '# Widget\nHello', rootFiles: ['Cargo.toml'] });
    expect(data.manifests['Cargo.toml']).toContain('name = "widget"');
    expect(d.urls.every((u) => u.startsWith('https://api.github.com/') || u.startsWith('https://raw.githubusercontent.com/'))).toBe(true);
  });

  it('rejects coordinates that are not a plain owner/name pair', async () => {
    const d = deps(okRoute);
    await expect(fetchRepo({ owner: '../etc', name: 'passwd' }, undefined, d)).rejects.toMatchObject({ code: 'REPO_NOT_FOUND' });
    await expect(fetchRepo({ owner: 'acme', name: '..' }, undefined, d)).rejects.toMatchObject({ code: 'REPO_NOT_FOUND' });
    expect(d.urls).toHaveLength(0);
  });

  it('maps 404 to REPO_NOT_FOUND without retrying', async () => {
    const d = deps(() => ({ status: 404 }));
    await expect(fetchRepo({ owner: 'acme', name: 'gone' }, undefined, d)).rejects.toMatchObject({ code: 'REPO_NOT_FOUND', retryable: false });
    expect(d.urls).toHaveLength(1);
  });

  it('maps an exhausted rate limit to REPO_RATE_LIMITED with the reset time', async () => {
    const d = deps(() => ({ status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' } }));
    await expect(fetchRepo({ owner: 'acme', name: 'widget' }, undefined, d)).rejects.toMatchObject({ code: 'REPO_RATE_LIMITED', retryable: true, details: { resetAt: '2027-01-15T08:00:00.000Z' } });
    expect(d.urls).toHaveLength(1);
  });

  it('retries transient failures twice, then reports REPO_NETWORK', async () => {
    let n = 0;
    const d = deps(() => { n++; return { status: 503 }; });
    await expect(fetchRepo({ owner: 'acme', name: 'widget' }, undefined, d)).rejects.toMatchObject({ code: 'REPO_NETWORK', retryable: true });
    expect(n).toBe(3);
  });

  it('tolerates a missing README or tree', async () => {
    const d = deps((url) => (url === 'https://api.github.com/repos/acme/widget' ? { status: 200, body: { default_branch: 'main' } } : { status: 404 }));
    const data = await fetchRepo({ owner: 'acme', name: 'widget' }, undefined, d);
    expect(data.readme).toBe('');
    expect(data.rootFiles).toEqual([]);
    expect(data.manifests).toEqual({});
  });

  it('sends the token when configured', async () => {
    let auth: string | null = null;
    const fakeFetch = (async (_: RequestInfo | URL, init?: RequestInit) => { auth = (init?.headers as Record<string, string>).Authorization ?? null; return new Response('{}', { status: 404 }); }) as unknown as typeof fetch;
    await fetchRepo({ owner: 'a', name: 'b' }, undefined, { fetch: fakeFetch, token: 'ghp_x', timeoutMs: 100, retries: 0, backoffMs: 0 }).catch(() => {});
    expect(auth).toBe('Bearer ghp_x');
  });
});
