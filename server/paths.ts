import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

/** Temp-file lifecycle. All media URLs are `/api/media/<hash>.<ext>`; only this module maps them to disk. */

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
 * An engine's project, written out to be served or rendered: a directory under the temp dir named by
 * the hash of what is in it. Only this module turns a key and a relative path into a location on disk.
 */
const PROJECT_KEY = /^[a-f0-9]{16,64}$/;

export function projectDir(key: string): string {
  if (!PROJECT_KEY.test(key)) throw new Error(`Invalid project key: ${key}`);
  return path.join(tmpDir(), 'projects', key);
}

/** A file inside a project; anything that would land outside it is refused. */
export function projectFilePath(key: string, relative: string): string {
  const root = projectDir(key);
  if (!relative || relative.startsWith('/') || relative.includes('\\') || relative.split('/').some((part) => part === '..' || part === '' || part.startsWith('.'))) {
    throw new Error(`Invalid project path: ${relative}`);
  }
  const p = path.join(root, relative);
  if (!p.startsWith(root + path.sep)) throw new Error('Path escapes the project dir');
  return p;
}

export function projectUrl(key: string, relative: string): string {
  projectFilePath(key, relative);
  return `/api/projects/${key}/${relative}`;
}

/**
^ * Assets a composition refers to (logos, screenshots, fonts): content-addressed files under `.nodecine/assets`, served
 * as `/api/assets/<hash>.<ext>`, never cleaned up (a workflow may point at them for years).
 */
export function assetsDir(): string {
  return path.resolve(process.cwd(), process.env.NODECINE_ASSETS_DIR ?? '.nodecine/assets');
}

export const ASSET_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

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

/** The file behind an `/api/assets/<name>` URL; refuses anything that is not one. */
export function fileNameFromAssetUrl(url: string): string {
  const m = /^\/api\/assets\/([a-f0-9]{16,64}\.[a-z0-9]+)$/.exec(url);
  if (!m) throw new Error(`Not an asset URL: ${url}`);
  return m[1]!;
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
