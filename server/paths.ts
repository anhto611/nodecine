import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

/** Temp-file lifecycle (ARCHITECTURE §6). All media URLs are `/api/media/<hash>.<ext>`; only this module maps them to disk. */

export function tmpDir(): string {
  return path.resolve(process.cwd(), process.env.NODECINE_TMP_DIR ?? '.nodecine/tmp');
}

const NAME = /^[a-f0-9]{16,64}\.[a-z0-9]+$/;

export async function ensureTmpDir(): Promise<string> {
  const dir = tmpDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

export function mediaUrl(fileName: string): string {
  if (!NAME.test(fileName)) throw new Error(`Invalid media file name: ${fileName}`);
  return `/api/media/${fileName}`;
}

/** Resolves a media file name to a path inside the temp dir; rejects anything that is not a plain hashed name. */
export function mediaPath(fileName: string): string {
  if (!NAME.test(fileName)) throw new Error(`Invalid media file name: ${fileName}`);
  const p = path.join(tmpDir(), fileName);
  if (path.dirname(p) !== tmpDir()) throw new Error('Path escapes the temp dir');
  return p;
}

export function fileNameFromMediaUrl(url: string): string {
  const m = /^\/api\/media\/([a-f0-9]{16,64}\.[a-z0-9]+)$/.exec(url);
  if (!m) throw new Error(`Not a media URL: ${url}`);
  return m[1]!;
}

/**
 * Assets a look refers to (logos, images): content-addressed files under `.nodecine/assets`, served
 * as `/api/assets/<hash>.<ext>`, never cleaned up (a workflow may point at them for years).
 */
export function assetsDir(): string {
  return path.resolve(process.cwd(), process.env.NODECINE_ASSETS_DIR ?? '.nodecine/assets');
}

export const ASSET_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };

export async function ensureAssetsDir(): Promise<string> {
  const dir = assetsDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

export function assetUrl(fileName: string): string {
  if (!NAME.test(fileName)) throw new Error(`Invalid asset file name: ${fileName}`);
  return `/api/assets/${fileName}`;
}

export function assetPath(fileName: string): string {
  if (!NAME.test(fileName)) throw new Error(`Invalid asset file name: ${fileName}`);
  const p = path.join(assetsDir(), fileName);
  if (path.dirname(p) !== assetsDir()) throw new Error('Path escapes the assets dir');
  return p;
}

/** Every `/api/assets/<name>` a piece of code refers to, once each. */
export function assetNamesIn(text: string): string[] {
  return [...new Set([...text.matchAll(/\/api\/assets\/([a-f0-9]{16,64}\.[a-z0-9]+)/g)].map((m) => m[1]!))];
}

/** Delete files older than `maxAgeMs` (default 24h). Runs at startup; no background job in v0.1. */
export async function cleanupTmp(maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
  const dir = await ensureTmpDir();
  const now = Date.now();
  let removed = 0;
  for (const name of await readdir(dir)) {
    const p = path.join(dir, name);
    try {
      const s = await stat(p);
      if (s.isFile() && now - s.mtimeMs > maxAgeMs) {
        await unlink(p);
        removed++;
      }
    } catch {
      /* ignore races */
    }
  }
  return removed;
}
