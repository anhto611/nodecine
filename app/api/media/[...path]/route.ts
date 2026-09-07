import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { mediaPath } from '@/server/paths';

const MIME: Record<string, string> = { mp3: 'audio/mpeg', mp4: 'video/mp4', aiff: 'audio/aiff', wav: 'audio/wav', png: 'image/png', srt: 'application/x-subrip', vtt: 'text/vtt' };

/** Read-only file serving from the temp dir; the name must be a bare hash (ARCHITECTURE §6). */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
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
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Length': String(s.size),
      'Cache-Control': 'private, max-age=3600',
      'Accept-Ranges': 'bytes',
    },
  });
}
