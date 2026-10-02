import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { contentHash, fnv1a64 } from '@/core/hash';

/**
 * A hash of the code that runs a node type, for the executor's signatures.
 *
 * `version` only moves when somebody remembers to move it, and on 2026-09-13 nobody did: the
 * emphasis fix shipped, the signatures matched, and films kept coming back from the cache with
 * asterisks on screen. This measures instead of trusting.
 *
 * What counts: every file in the node's capsule except its tests and its face (`*.tsx`, the
 * strings, the manifest) — a Python script the node runs counts as much as its TypeScript — then
 * everything those files import, followed through `@/` and relative paths, and the installed
 * version of every package on the way. What does not: a provider or an engine reached through
 * `services`, which the node never imports.
 *
 * Read from disk on demand and remembered per file by modification time, so an unchanged tree costs a
 * `stat` per file. A long-lived host that keeps running the code it loaded should measure once and
 * keep the answer (server/contracts/hub.ts), or its signatures describe code it is not running.
 */

const root = process.cwd();
const SOURCE = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/;
const FACE = /(\.tsx$|^locales\.ts$|^node\.manifest\.json$)/;
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"\n]+)['"]/g;
const RESOLVE = ['', '.ts', '.tsx', '.mts', '.js', '.mjs', '/index.ts', '/index.tsx', '/index.js'];

type Seen = { mtimeMs: number; size: number; hash: string; imports: string[] };
const files = new Map<string, Seen>();
const versions = new Map<string, string>();

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function resolve(from: string, specifier: string): string | { pkg: string } | null {
  if (specifier.startsWith('node:')) return null;
  let base: string;
  if (specifier.startsWith('@/')) base = path.join(root, specifier.slice(2));
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(from), specifier);
  else return { pkg: specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]! };
  for (const ext of RESOLVE) if (isFile(base + ext)) return base + ext;
  return null;
}

function read(file: string): Seen | null {
  let st;
  try {
    st = statSync(file);
  } catch {
    return null;
  }
  const known = files.get(file);
  if (known && known.mtimeMs === st.mtimeMs && known.size === st.size) return known;
  const text = readFileSync(file, 'utf8');
  const imports = SOURCE.test(file) ? [...text.matchAll(SPECIFIER)].map((m) => m[1]!) : [];
  const seen = { mtimeMs: st.mtimeMs, size: st.size, hash: fnv1a64(text), imports };
  files.set(file, seen);
  return seen;
}

function packageVersion(pkg: string): string {
  const known = versions.get(pkg);
  if (known) return known;
  let version = 'unknown';
  try {
    version = String((JSON.parse(readFileSync(path.join(root, 'node_modules', pkg, 'package.json'), 'utf8')) as { version?: unknown }).version ?? 'unknown');
  } catch {
    /* not installed where we look */
  }
  versions.set(pkg, version);
  return version;
}

function capsuleFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name === '__tests__' || entry.name.startsWith('.')) continue;
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (!FACE.test(entry.name) && !/\.(test|manual\.test)\.[cm]?[jt]sx?$/.test(entry.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

/** The fingerprint of a folder of code: what is in it and everything it reaches. Exported for tests. */
export function fingerprintOfFolder(dir: string): string {
  const abs = path.resolve(root, dir);
  const parts: [string, string][] = [];
  const done = new Set<string>();
  const stack = existsSync(abs) ? capsuleFiles(abs) : [];
  while (stack.length) {
    const file = stack.pop()!;
    if (done.has(file)) continue;
    done.add(file);
    const seen = read(file);
    if (!seen) continue;
    parts.push([path.relative(root, file), seen.hash]);
    for (const specifier of seen.imports) {
      const target = resolve(file, specifier);
      if (target === null) continue;
      if (typeof target === 'string') {
        // A test helper imported by production code is still code; only the capsule's own tests are left out.
        if (!done.has(target) && !target.includes(`${path.sep}node_modules${path.sep}`)) stack.push(target);
      } else if (!done.has(`pkg:${target.pkg}`)) {
        done.add(`pkg:${target.pkg}`);
        parts.push([`pkg:${target.pkg}`, packageVersion(target.pkg)]);
      }
    }
  }
  return contentHash(parts.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
}

/**
 * Fingerprints for the node types whose code lives in `sources` (type → capsule folder); nothing for a
 * type not listed, such as a test's. Measured on every call: a warm capsule is a `stat` per file.
 */
export function fingerprintFor(sources: Readonly<Record<string, string>>): (type: string) => string | undefined {
  return (type) => {
    const dir = sources[type];
    return dir ? fingerprintOfFolder(dir) : undefined;
  };
}

/** Test-only. */
export function _forgetFingerprints(): void {
  files.clear();
  versions.clear();
}
