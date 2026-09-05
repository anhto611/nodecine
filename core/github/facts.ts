/**
 * Build the FactSheet `facts` record from raw repository data (github-showcase spec §2.2, §2.3).
 * Pure: no network, no clock. The server handler gathers data; this decides what becomes a fact.
 */
import type { FactSheet } from '../types/payloads';
import { repoUrl, type RepoCoords } from './parse-source';

export const README_MAX_CHARS = 4000;

/** What the server returns for `fetch-repo`; kept close to the GitHub API shape but trimmed. */
export interface RepoData {
  owner: string;
  name: string;
  description: string | null;
  stars: number | null;
  topics: string[];
  language: string | null;
  defaultBranch: string;
  /** README body as served by GitHub (raw markdown), or empty. */
  readme: string;
  /** Names of files at the repository root. */
  rootFiles: string[];
  /** Raw contents of recognised manifest files found at the root. */
  manifests: Partial<Record<'package.json' | 'pyproject.toml' | 'go.mod' | 'Cargo.toml', string>>;
  /** Pieces GitHub failed to serve after retries; the facts are built without them. */
  degraded?: string[];
}

export type Facts = FactSheet['facts'];

/** Strip markdown syntax down to plain prose and cap the length at a word boundary. */
export function stripMarkdown(md: string, max = README_MAX_CHARS): string {
  let s = md.replace(/\r\n?/g, '\n');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/```[\s\S]*?```/g, ' ');
  s = s.replace(/~~~[\s\S]*?~~~/g, ' ');
  s = s.replace(/<[^>\n]+>/g, ' ');
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1');
  s = s.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '');
  s = s.replace(/^[ \t]{0,3}(?:[-*+]|\d+\.)[ \t]+/gm, '');
  s = s.replace(/^[ \t]{0,3}>[ \t]?/gm, '');
  s = s.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, '');
  s = s.replace(/^\|.*\|\s*$/gm, (row) => row.replace(/\|/g, ' '));
  s = s.replace(/`([^`]*)`/g, '$1');
  s = s.replace(/(\*\*|__)(.*?)\1/g, '$2');
  s = s.replace(/(\*|_)(.*?)\1/g, '$2');
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return (at > max * 0.6 ? cut.slice(0, at) : cut).trimEnd() + '…';
}

function tomlString(src: string, section: string, key: string): string | null {
  const sec = new RegExp(`^\\s*\\[${section.replace('.', '\\.')}\\]\\s*$([\\s\\S]*?)(?=^\\s*\\[|$(?![\\s\\S]))`, 'm').exec(src);
  if (!sec) return null;
  const m = new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']`, 'm').exec(sec[1] ?? '');
  return m ? m[1]! : null;
}

const INSTALL_LINE = /^\s*(?:\$\s*)?((?:pip3?|pipx|uv pip) install [^\s|&;]+|(?:npm|pnpm|yarn|bun) (?:i|install|add) [^\s|&;]+|(?:cargo|go|brew|gem|dotnet tool|composer) (?:install|get|add|require) [^\s|&;]+|git clone \S+)\s*$/;

/**
 * What the README itself tells people to run. A manifest names the package, but the thing users
 * install is often another one (a CLI, a meta-package) or a clone, and only the README knows.
 * The first plain install line wins — one target, no flags or index URLs — preferring one that names
 * the repository or one of the candidate package names.
 */
export function readmeInstallCommand(readme: string, candidates: string[]): string | null {
  const lines = readme.split(/\r?\n/).map((l) => INSTALL_LINE.exec(l.replace(/^```\s*|\s*```$/g, ''))?.[1]?.trim()).filter((x): x is string => !!x);
  if (!lines.length) return null;
  const names = candidates.map((c) => c.toLowerCase()).filter(Boolean);
  return lines.find((l) => names.some((n) => l.toLowerCase().includes(n))) ?? lines[0]!;
}

/** Spec §2.3: the README's own instruction first, then the manifests; the clone fallback lives here so the assembler stays a pure copier. */
export function inferInstallCommand(data: Pick<RepoData, 'manifests' | 'rootFiles'> & { readme?: string }, coords: RepoCoords | null): string {
  const { manifests, rootFiles } = data;
  if (data.readme) {
    const fromReadme = readmeInstallCommand(data.readme, [coords?.name ?? '', packageName(manifests)]);
    if (fromReadme) return fromReadme;
  }
  if (manifests['package.json']) {
    try {
      const pkg = JSON.parse(manifests['package.json']) as { name?: unknown; private?: unknown };
      if (typeof pkg.name === 'string' && pkg.name && pkg.private !== true) return `npm install ${pkg.name}`;
    } catch {
      /* not JSON; fall through */
    }
  }
  if (manifests['pyproject.toml'] || rootFiles.includes('setup.py')) {
    const name = manifests['pyproject.toml'] ? (tomlString(manifests['pyproject.toml'], 'project', 'name') ?? tomlString(manifests['pyproject.toml'], 'tool.poetry', 'name')) : null;
    if (name) return `pip install ${name}`;
    if (coords) return `pip install ${coords.name}`;
  }
  if (manifests['go.mod']) {
    const m = /^module\s+(\S+)/m.exec(manifests['go.mod']);
    if (m) return `go install ${m[1]}@latest`;
  }
  if (manifests['Cargo.toml']) {
    const name = tomlString(manifests['Cargo.toml'], 'package', 'name');
    if (name) return `cargo install ${name}`;
  }
  return coords ? `git clone https://github.com/${coords.owner}/${coords.name}` : '';
}

function packageName(manifests: RepoData['manifests']): string {
  try {
    const pkg = manifests['package.json'] ? (JSON.parse(manifests['package.json']) as { name?: unknown }) : null;
    if (pkg && typeof pkg.name === 'string') return pkg.name;
  } catch {
    /* not JSON */
  }
  return (manifests['pyproject.toml'] && (tomlString(manifests['pyproject.toml'], 'project', 'name') ?? tomlString(manifests['pyproject.toml'], 'tool.poetry', 'name'))) || '';
}

export function buildFetchedFacts(data: RepoData): Facts {
  const coords = { owner: data.owner, name: data.name };
  return {
    owner: data.owner,
    name: data.name,
    url: repoUrl(coords),
    description: data.description ?? '',
    stars: data.stars,
    topics: data.topics,
    primaryLanguage: data.language ?? '',
    readmeExcerpt: stripMarkdown(data.readme),
    installCommand: inferInstallCommand(data, coords),
  };
}

/** Passthrough mode (§2.1): the user's text becomes the excerpt, every other fact is empty. */
export function buildPassthroughFacts(text: string): Facts {
  return {
    owner: '',
    name: '',
    url: '',
    description: '',
    stars: null,
    topics: [],
    primaryLanguage: '',
    readmeExcerpt: text,
    installCommand: '',
  };
}
