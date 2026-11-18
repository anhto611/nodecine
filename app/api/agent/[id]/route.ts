import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GraphSchema } from '@/core/engine/document';
import { agentTurn, cancelTurn, deleteChat, moveChat, readChat } from '@/server/contracts/agent';

type Ctx = { params: Promise<{ id: string }> };
const fail = (e: unknown, status = 400) => NextResponse.json({ error: (e as { code?: string }).code ?? 'AGENT_FAILED', message: e instanceof Error ? e.message : String(e) }, { status });

const Runtime = z.object({
  state: z.string().max(20),
  error: z.object({ code: z.string().max(80), message: z.string().max(2000), fix: z.string().max(500).optional() }).optional(),
  warnings: z.array(z.string().max(400)).max(10).optional(),
  outputs: z.record(z.string(), z.string().max(2000)).optional(),
});

const Turn = z.object({
  message: z.object({ role: z.enum(['user', 'event']), text: z.string().min(1).max(20_000) }),
  workflowName: z.string().max(200).default(''),
  graph: GraphSchema,
  runtimes: z.record(z.string(), Runtime).default({}),
  running: z.boolean().default(false),
  focus: z.object({ nodeId: z.string().max(120), outputs: z.record(z.string(), z.string().max(40_000)) }).optional(),
});

/** Take another agent's conversation: a draft saved as a file, a workflow saved under a new name. */
const Patch = z.union([
  z.object({ from: z.string().max(100), mode: z.enum(['move', 'copy']) }),
  /** Stop the turn being answered. */
  z.object({ cancel: z.literal(true) }),
]);

/** One workflow's agent: its conversation, a turn of it, or a fresh start. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await readChat(id));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = Turn.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request', issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  try {
    // Stop comes as a request of its own (PATCH cancel); a closed request stops the model too.
    return NextResponse.json(await agentTurn(id, parsed.data, req.signal));
  } catch (e) {
    return fail(e, 500);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  try {
    const p = parsed.data;
    if ('cancel' in p) return NextResponse.json({ cancelled: cancelTurn(id) });
    return NextResponse.json(await moveChat(p.from, id, p.mode));
  } catch (e) {
    return fail(e);
  }
}

/** A fresh start. The model is the workflow's and stays with it. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await deleteChat(id);
    return NextResponse.json(await readChat(id));
  } catch (e) {
    return fail(e);
  }
}
