import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { copyFile, rename, stat } from 'node:fs/promises';
import { z } from 'zod';
import { assetPath, assetUrl, ensureAssetsDir, isLibrary, libraryPath } from '@/server/paths';

const Body = z.object({ library: z.string(), file: z.string().max(120) });

/**
 * Take a file the user dropped in one of their own folders into the look's asset store
 * (CORE_CONTRACTS §2.7). A clip is far too big to travel as a base64 data URL the way a logo does,
 * so nothing crosses the wire but the name: the server reads the file where it lies, hashes it, and
 * copies it in under that hash. Uploading the same clip twice is one file.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isLibrary(parsed.data.library)) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  let source: string;
  try {
    source = libraryPath(parsed.data.library, parsed.data.file);
  } catch (e) {
    return NextResponse.json({ error: 'ASSET_NAME', message: e instanceof Error ? e.message : 'bad name' }, { status: 400 });
  }
  const s = await stat(source).catch(() => null);
  if (!s?.isFile()) return NextResponse.json({ error: 'ASSET_MISSING', message: `no file named "${parsed.data.file}"` }, { status: 404 });

  const ext = source.slice(source.lastIndexOf('.') + 1).toLowerCase();
  const name = `${await hashFile(source)}.${ext}`;
  const target = assetPath(name);
  await ensureAssetsDir();
  if (!(await stat(target).then(() => true, () => false))) {
    const tmp = `${target}.${process.pid}.part`;
    await copyFile(source, tmp);
    await rename(tmp, target);
  }
  return NextResponse.json({ url: assetUrl(path.basename(target)), bytes: s.size });
}

/** Read as a stream: a clip must not have to fit in memory to be hashed. */
async function hashFile(file: string): Promise<string> {
  const hash = createHash('sha1');
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}
