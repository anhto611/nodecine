import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GraphSchema } from '@/core/templates/registry';
import { jobHub } from '@/server/jobs';

type Ctx = { params: Promise<{ key: string }> };

const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('graph'), graph: GraphSchema, name: z.string().max(200).optional() }),
  z.object({ action: z.literal('invalidate'), nodeId: z.string() }),
  z.object({ action: z.literal('bypass'), nodeId: z.string(), bypassed: z.boolean() }),
  z.object({ action: z.literal('cancel') }),
]);

/** The executor behind one workflow key: its current state, and the edits that must reach it between jobs. */
export async function GET(_req: Request, ctx: Ctx) {
  const { key } = await ctx.params;
  const snap = jobHub().snapshot(key);
  return snap ? NextResponse.json(snap) : NextResponse.json({ error: 'EXECUTOR_NOT_FOUND' }, { status: 404 });
}

export async function POST(req: Request, ctx: Ctx) {
  const { key } = await ctx.params;
  const parsed = Action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request', issues: parsed.error.issues }, { status: 400 });
  const hub = jobHub();
  try {
    const a = parsed.data;
    if (a.action === 'graph') hub.slot(key, a.graph, a.name);
    else if (a.action === 'invalidate') hub.invalidate(key, a.nodeId);
    else if (a.action === 'bypass') hub.setBypassed(key, a.nodeId, a.bypassed);
    else hub.cancelKey(key);
    return NextResponse.json(hub.snapshot(key) ?? { runtimes: {}, logs: [], running: false, pending: [] });
  } catch (e) {
    return NextResponse.json({ error: (e as { code?: string }).code ?? 'EXECUTOR_INVALID', message: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
