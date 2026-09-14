import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, unlink, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CachedResult, ResultCache } from '@/core/engine/result-cache';
import { assetPath, mediaPath } from './paths';

/**
 * Results kept on disk by signature: `.nodecine/cache/results/<signature>.json`,
 * beside the model answers in `.nodecine/cache/llm`. `NODECINE_CACHE_DIR` moves both.
 *
 * A result is only as good as the files it points at. A voice-over is a URL into the temp dir, and
 * the temp dir is cleaned; a result naming a file that is gone is a miss, and the file is dropped,
 * so the node runs and makes the file again instead of handing on a link to nothing.
 */

export function resultsDir(): string {
  return path.resolve(process.cwd(), process.env.NODECINE_CACHE_DIR ?? '.nodecine/cache', 'results');
}

const SIGNATURE = /^[a-f0-9]{8,64}$/;
/** Enough for weeks of work on a handful of workflows; the oldest by use go first. */
const MAX_ENTRIES = 5000;
const PRUNE_EVERY = 100;

/** Every file a result names, as the path it lives at. */
function filesNamedIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\/api\/media\/([a-f0-9]{16,64}\.[a-z0-9]+)/g)) out.push(mediaPath(m[1]!));
  for (const m of text.matchAll(/\/api\/assets\/([a-f0-9]{16,64}\.[a-z0-9]+)/g)) out.push(assetPath(m[1]!));
  return [...new Set(out)];
}

export class DiskResultCache implements ResultCache {
  private writes = 0;

  constructor(private readonly dir: () => string = resultsDir) {}

  private file(signature: string): string | null {
    return SIGNATURE.test(signature) ? path.join(this.dir(), `${signature}.json`) : null;
  }

  async get(signature: string): Promise<CachedResult | undefined> {
    const file = this.file(signature);
    if (!file) return undefined;
    let text: string;
    try { text = await readFile(file, 'utf8'); } catch { return undefined; }
    if (filesNamedIn(text).some((p) => !existsSync(p))) {
      await unlink(file).catch(() => undefined);
      return undefined;
    }
    try {
      const result = JSON.parse(text) as CachedResult;
      // Touch it: pruning goes by last use, and this is a use.
      const now = new Date();
      await utimes(file, now, now).catch(() => undefined);
      return result;
    } catch {
      return undefined;
    }
  }

  async set(signature: string, result: CachedResult): Promise<void> {
    const file = this.file(signature);
    if (!file) return;
    await mkdir(this.dir(), { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.part`;
    await writeFile(tmp, JSON.stringify(result), 'utf8');
    await rename(tmp, file);
    if (++this.writes % PRUNE_EVERY === 0) await this.prune();
  }

  /** Keep the newest `MAX_ENTRIES` by last use. */
  async prune(max = MAX_ENTRIES): Promise<void> {
    let names: string[];
    try { names = (await readdir(this.dir())).filter((n) => n.endsWith('.json')); } catch { return; }
    if (names.length <= max) return;
    const dated = await Promise.all(names.map(async (n) => ({ n, t: (await stat(path.join(this.dir(), n)).catch(() => ({ mtimeMs: 0 }))).mtimeMs })));
    dated.sort((a, b) => b.t - a.t);
    await Promise.all(dated.slice(max).map(({ n }) => unlink(path.join(this.dir(), n)).catch(() => undefined)));
  }
}
