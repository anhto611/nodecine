import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { writeFile, rename } from 'node:fs/promises';
import { z } from 'zod';
import { ASSET_TYPES, assetUrl, ensureAssetsDir } from '@/server/paths';

const MAX_BYTES = 2 * 1024 * 1024;
const Body = z.object({
  /** `data:image/png;base64,...` from a file picker. */
  dataUrl: z.string().max(MAX_BYTES * 2),
});

/**
 * Upload an image for a scene. The file is named by its content hash, so the same logo uploaded
 * twice is one file, and the code can refer to it by a name the server can validate.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const m = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/.exec(parsed.data.dataUrl);
  if (!m) return NextResponse.json({ error: 'ASSET_TYPE', message: 'not an image data URL' }, { status: 400 });
  const ext = Object.entries(ASSET_TYPES).find(([, mime]) => mime === m[1])?.[0];
  if (!ext) return NextResponse.json({ error: 'ASSET_TYPE', message: `unsupported image type ${m[1]}` }, { status: 400 });
  const bytes = Buffer.from(m[2]!, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return NextResponse.json({ error: 'ASSET_SIZE', message: `images up to ${MAX_BYTES / 1024 / 1024} MB` }, { status: 400 });
  const name = `${createHash('sha1').update(bytes).digest('hex')}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const dir = await ensureAssetsDir();
  const target = path.join(dir, name);
  const tmp = `${target}.${process.pid}.part`;
  await writeFile(tmp, bytes);
  await rename(tmp, target);
  return NextResponse.json({ url: assetUrl(name), bytes: bytes.length });
}
