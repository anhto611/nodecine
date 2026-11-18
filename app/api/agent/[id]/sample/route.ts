import { NextResponse } from 'next/server';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { analyzeSample, analyzeSampleLink } from '@/server/contracts/video-sample';

const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

const fail = (e: unknown) => {
  const err = e as { code?: string; fix?: string };
  return NextResponse.json(
    { error: err.code ?? 'SAMPLE_UNREADABLE', message: e instanceof Error ? e.message : String(e), ...(err.fix ? { fix: err.fix } : {}) },
    { status: err.code === 'PROVIDER_NOT_INSTALLED' ? 424 : 400 },
  );
};

/**
 * A sample video for this workflow's agent: a file (multipart field `file`) or a link (JSON `{ url }`),
 * read by rea-video and answered with its profile. The same video is read once; again, it answers at once.
 */
export async function POST(req: Request) {
  if (req.headers.get('content-type')?.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
    if (typeof body?.url !== 'string' || !body.url.trim() || body.url.length > 2000) return NextResponse.json({ error: 'bad request', message: 'a "url" is required' }, { status: 400 });
    try {
      return NextResponse.json(await analyzeSampleLink(body.url, req.signal));
    } catch (e) {
      return fail(e);
    }
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'bad request', message: 'multipart field "file" is required' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'SAMPLE_TOO_LARGE', message: 'the video is larger than 512 MB' }, { status: 413 });
  const name = (file instanceof File && file.name ? file.name : 'sample.mp4').slice(0, 120);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'nodecine-sample-'));
  const p = path.join(dir, `in${path.extname(name) || '.mp4'}`);
  try {
    await writeFile(p, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json(await analyzeSample(p, name, req.signal));
  } catch (e) {
    return fail(e);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
