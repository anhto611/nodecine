import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { byteRange } from '@/server/byte-range';
import { projectFilePath } from '@/server/paths';

const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
  woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf',
};

/** Read-only serving of an engine project written under the temp dir: its preview page and its files. */
export async function GET(req: Request, ctx: { params: Promise<{ key: string; path: string[] }> }) {
  const { key, path: segments } = await ctx.params;
  let filePath: string;
  try {
    filePath = projectFilePath(key, segments.join('/'));
  } catch {
    return new Response('not found', { status: 404 });
  }
  const s = await stat(filePath).catch(() => null);
  if (!s?.isFile()) return new Response('not found', { status: 404 });
  const type = MIME[filePath.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
  const range = byteRange(req.headers.get('range'), s.size);
  if (range === 'unsatisfiable') return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${s.size}` } });
  const { start, end } = range ?? { start: 0, end: s.size - 1 };
  const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
  return new Response(stream, {
    status: range ? 206 : 200,
    headers: {
      'Content-Type': type,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
      // The player runs a composition in a sandbox with no origin, so its fonts and fetched JSON are
      // cross-origin requests; without this the preview drops to system faces and loses its data.
      'Access-Control-Allow-Origin': '*',
      ...(range ? { 'Content-Range': `bytes ${start}-${end}/${s.size}` } : {}),
    },
  });
}
