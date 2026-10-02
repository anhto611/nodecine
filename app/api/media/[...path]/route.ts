import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { mediaPath } from '@/server/paths';
import { byteRange } from '@/server/byte-range';

const MIME: Record<string, string> = { mp3: 'audio/mpeg', mp4: 'video/mp4', aiff: 'audio/aiff', wav: 'audio/wav', png: 'image/png', srt: 'application/x-subrip', vtt: 'text/vtt' };

/** Read-only file serving from the temp dir; the name must be a bare hash. */
export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;
  if (segments.length !== 1) return new Response('not found', { status: 404 });
  let filePath: string;
  try {
    filePath = mediaPath(segments[0]!);
  } catch {
    return new Response('not found', { status: 404 });
  }
  const s = await stat(filePath).catch(() => null);
  if (!s?.isFile()) return new Response('not found', { status: 404 });
  const ext = filePath.split('.').pop() ?? '';
  const headers: Record<string, string> = {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': 'private, max-age=3600',
    'Accept-Ranges': 'bytes',
  };

  const range = byteRange(req.headers.get('range'), s.size);
  if (range === 'unsatisfiable') {
    return new Response('range not satisfiable', {
      status: 416,
      headers: { ...headers, 'Content-Range': `bytes */${s.size}` },
    });
  }
  if (range) {
    const stream = Readable.toWeb(createReadStream(filePath, { start: range.start, end: range.end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        ...headers,
        'Content-Length': String(range.end - range.start + 1),
        'Content-Range': `bytes ${range.start}-${range.end}/${s.size}`,
      },
    });
  }
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, 'Content-Length': String(s.size) } });
}
