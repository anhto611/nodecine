import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { ASSET_TYPES, assetPath } from '@/server/paths';
import { byteRange } from '@/server/byte-range';

/**
 * Read-only serving of look assets; the name must be a bare hash (ARCHITECTURE §6).
 *
 * Ranges are answered here because a video that cannot be ranged cannot be streamed; the reading of
 * the header itself lives in `server/byte-range.ts`.
 */
export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
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
  const headers: Record<string, string> = {
    'Content-Type': ASSET_TYPES[ext] ?? 'application/octet-stream',
    'Cache-Control': 'private, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
  };

  const range = byteRange(req.headers.get('range'), s.size);
  if (range === 'unsatisfiable') return new Response('range not satisfiable', { status: 416, headers: { ...headers, 'Content-Range': `bytes */${s.size}` } });
  if (range) {
    const stream = Readable.toWeb(createReadStream(filePath, { start: range.start, end: range.end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, 'Content-Length': String(range.end - range.start + 1), 'Content-Range': `bytes ${range.start}-${range.end}/${s.size}` },
    });
  }
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, 'Content-Length': String(s.size) } });
}
