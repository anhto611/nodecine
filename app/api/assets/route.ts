import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { writeFile, rename, unlink } from 'node:fs/promises';
import { z } from 'zod';
import { ASSET_TYPES, assetUrl, ensureAssetsDir } from '@/server/paths';

// A phone screenshot saved as PNG often runs past 2 MB.
const MAX_BYTES = 8 * 1024 * 1024;
// A recorded clip is another order of thing: three minutes of 1080p is tens of megabytes.
const MAX_CLIP_BYTES = 500 * 1024 * 1024;
const CLIP_TYPES = new Set(['mp4', 'webm', 'mov', 'm4v']);
const Body = z.object({
  /** `data:image/png;base64,...` from a file picker. */
  dataUrl: z.string().max(MAX_BYTES * 2),
});

/**
 * Upload a picture or a recorded clip. The file is named by its content hash, so the same logo
 * uploaded twice is one file, and the code can refer to it by a name the server can validate.
 *
 * A picture comes as a data URL, the shape a file picker hands JavaScript. A clip comes as the file
 * itself, `multipart/form-data`: base64 would carry a third more bytes and hold the whole recording in
 * memory twice over.
 */
export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';
  return contentType.startsWith('multipart/form-data') ? postFile(req) : postDataUrl(req);
}

async function postDataUrl(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const m = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/.exec(parsed.data.dataUrl);
  if (!m) return NextResponse.json({ error: 'ASSET_TYPE', message: 'not an image data URL' }, { status: 400 });
  const ext = Object.entries(ASSET_TYPES).find(([, mime]) => mime === m[1])?.[0];
  if (!ext) return NextResponse.json({ error: 'ASSET_TYPE', message: `unsupported image type ${m[1]}` }, { status: 400 });
  const bytes = Buffer.from(m[2]!, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return NextResponse.json({ error: 'ASSET_SIZE', message: `images up to ${MAX_BYTES / 1024 / 1024} MB` }, { status: 400 });
  return save(bytes, ext === 'jpeg' ? 'jpg' : ext);
}

async function postFile(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'bad request', message: 'no file' }, { status: 400 });
  // The kind is read from the name, not from what the browser claims: the server only serves what it can name.
  const ext = (/\.([a-z0-9]+)$/i.exec(file.name)?.[1] ?? '').toLowerCase();
  if (!CLIP_TYPES.has(ext)) return NextResponse.json({ error: 'ASSET_TYPE', message: `a clip must be ${[...CLIP_TYPES].join(', ')}` }, { status: 400 });
  if (file.size === 0 || file.size > MAX_CLIP_BYTES) return NextResponse.json({ error: 'ASSET_SIZE', message: `clips up to ${MAX_CLIP_BYTES / 1024 / 1024} MB` }, { status: 400 });
  return save(Buffer.from(await file.arrayBuffer()), ext);
}

async function save(bytes: Buffer, ext: string) {
  const name = `${createHash('sha1').update(bytes).digest('hex')}.${ext}`;
  const dir = await ensureAssetsDir();
  const target = path.join(dir, name);
  const tmp = `${target}.${randomUUID()}.part`;
  try {
    await writeFile(tmp, bytes);
    await rename(tmp, target);
  } finally {
    await unlink(tmp).catch(() => undefined);
  }
  return NextResponse.json({ url: assetUrl(name), bytes: bytes.length });
}
