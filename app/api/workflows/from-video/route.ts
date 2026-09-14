import { NextResponse } from 'next/server';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readWorkflowTag } from '@/server/contracts/video-meta';
import { workflows } from '@/server/contracts/workflows';

const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

/** Reads the workflow tag out of an uploaded MP4 (multipart field `file`) and returns it as a workflow definition. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'bad request', message: 'multipart field "file" is required' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'WORKFLOW_TOO_LARGE', message: 'file too large' }, { status: 413 });
  const dir = await mkdtemp(path.join(os.tmpdir(), 'nodecine-video-'));
  const p = path.join(dir, 'in.mp4');
  try {
    await writeFile(p, Buffer.from(await file.arrayBuffer()));
    const tag = await readWorkflowTag(p, req.signal);
    if (!tag) return NextResponse.json({ error: 'WORKFLOW_NOT_FOUND', message: 'this video carries no NodeCine workflow' }, { status: 404 });
    return NextResponse.json(workflows.toWorkflowFile(tag));
  } catch (e) {
    return NextResponse.json({ error: (e as { code?: string }).code ?? 'WORKFLOW_INVALID', message: e instanceof Error ? e.message : String(e) }, { status: 400 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
