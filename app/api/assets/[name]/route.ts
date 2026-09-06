import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { ASSET_TYPES, assetPath } from '@/server/paths';

/** Read-only serving of look assets; the name must be a bare hash (ARCHITECTURE §6). */
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  let filePath: string;
  try {
    filePath = assetPath(name);
  } catch {
    return new Response('not found', { status: 404 });
  }
  const s = await stat(filePath).catch(() => null);
  if (!s?.isFile()) return new Response('not found', { status: 404 });
  const ext = filePath.split('.').pop() ?? '';
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, { headers: { 'Content-Type': ASSET_TYPES[ext] ?? 'application/octet-stream', 'Content-Length': String(s.size), 'Cache-Control': 'private, max-age=31536000, immutable' } });
}
