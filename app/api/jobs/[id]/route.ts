import { NextResponse } from 'next/server';
import { jobHub } from '@/server/contracts/hub';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const job = jobHub().get(id);
  return job ? NextResponse.json({ job }) : NextResponse.json({ error: 'JOB_NOT_FOUND' }, { status: 404 });
}

/** Cancel: a pending job is dropped, a running one interrupted, a finished one left alone. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const was = jobHub().cancel(id);
  return was === 'unknown' ? NextResponse.json({ error: 'JOB_NOT_FOUND' }, { status: 404 }) : NextResponse.json({ was });
}
