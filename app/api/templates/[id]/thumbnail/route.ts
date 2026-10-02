import { readFile } from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { thumbnailFile } from '@/server/templates';

type Ctx = { params: Promise<{ id: string }> };

/**
 * The card art of a bundled template, read from the folder that owns it. It is a route rather than a
 * file under `public/` so that everything a template needs lives in `templates/<id>/` and nothing
 * has to be copied twice. The id is resolved against the generated registry first, so the request
 * never decides which file is read.
 */
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const file = thumbnailFile(id);
  if (!file) return NextResponse.json({ error: 'TEMPLATE_NOT_FOUND' }, { status: 404 });
  try {
    const body = await readFile(file.path);
    return new NextResponse(new Uint8Array(body), {
      headers: { 'content-type': file.type, 'cache-control': 'public, max-age=3600', 'x-content-type-options': 'nosniff' },
    });
  } catch (error) {
    return NextResponse.json({ error: 'TEMPLATE_UNAVAILABLE', message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
