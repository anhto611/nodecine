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
 * Big files the user brings themselves: music beds, their own recordings, video clips. None of them
 * is uploaded through the app — somebody's licensed track, their own voice or a 200 MB clip stays
 * where they put it, and only the file name travels in a graph they may share. Empty registry: the
 * node that reads a kind of file declares its folder in its manifest (`libraries`), and server
 * registration fills this in at startup.
 */
export interface LibrarySpec { env: string; extensions: readonly string[] }
const LIBRARIES = new Map<string, LibrarySpec>();
export type Library = string;

export function registerLibrary(name: Library, spec: LibrarySpec): void {
  if (!/^[a-z][a-z0-9-]{0,30}$/.test(name)) throw new Error(`Invalid library name: ${name}`);
  LIBRARIES.set(name, spec);
}
export const isLibrary = (v: string): v is Library => LIBRARIES.has(v);
const specOf = (library: Library): LibrarySpec => {
  const spec = LIBRARIES.get(library);
  if (!spec) throw new Error(`Unknown library: ${library}`);
  return spec;
};

/** Letters, digits and the punctuation a person actually types in a file name — nothing that could be a path. */
const STEM = /^[A-Za-z0-9][A-Za-z0-9 ._'()-]{0,80}$/;

export function libraryDir(library: Library): string {
  return path.resolve(process.cwd(), process.env[specOf(library).env] ?? `.nodecine/${library}`);
}

const namedForLibrary = (library: Library, fileName: string): boolean => {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return false;
  return STEM.test(fileName.slice(0, dot)) && specOf(library).extensions.includes(fileName.slice(dot + 1).toLowerCase());
};

/** Resolve a file name to a path inside one of those folders; anything that could leave it is refused. */
export function libraryPath(library: Library, fileName: string): string {
  if (!namedForLibrary(library, fileName)) throw new Error(`Invalid ${library} file name: ${fileName}`);
  const dir = libraryDir(library);
  const p = path.join(dir, fileName);
  if (path.dirname(p) !== dir) throw new Error(`Path escapes the ${library} folder`);
  return p;
}

/** What that folder holds on this machine, by name, sorted; an absent folder simply has nothing. */
export async function listLibrary(library: Library): Promise<string[]> {
  return readdir(libraryDir(library))
    .then((names) => names.filter((n) => namedForLibrary(library, n)).sort((a, b) => a.localeCompare(b)))
    .catch(() => []);
}

/**
 * Assets a scene refers to (logos, images): content-addressed files under `.nodecine/assets`, served
 * as `/api/assets/<hash>.<ext>`, never cleaned up (a workflow may point at them for years).
 */
export function assetsDir(): string {
  return path.resolve(process.cwd(), process.env.NODECINE_ASSETS_DIR ?? '.nodecine/assets');
}

export const ASSET_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/x-m4v' };

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
