import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GraphSchema } from '@/core/engine/document';
import { workflowModel } from '@/contracts/workflow-model';
import { firstModel } from '@/server/contracts/workflow-model';
import { readSample } from '@/server/contracts/video-sample';
import { holdsKit } from '@/contracts/agent/kit';
import { ensureServerRegistrations } from '@/server/contracts/register';
import { cancelKitSession, pruneKits, readKitSession, startKitSession } from '@/server/contracts/kit-session';

type Ctx = { params: Promise<{ id: string }> };

const Start = z.object({
  nodeId: z.string().min(1).max(120),
  request: z.string().min(1).max(8000),
  graph: GraphSchema,
  sample: z
    .string()
    .regex(/^[a-f0-9]{16}$/)
    .optional(),
});

/**
 * A kit built by a coding agent for this workflow's Composition node: start one (POST), follow it
 * (GET ?session=), or stop it (DELETE ?session=). The kit and the model come from the graph sent.
 */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = Start.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request', issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const { nodeId, request, graph, sample } = parsed.data;
  const node = graph.nodes.find((n) => n.id === nodeId);
  ensureServerRegistrations();
  if (!node || !holdsKit(node.type)) return NextResponse.json({ error: 'KIT_NODE_INVALID', message: `${nodeId} is not a Composition node in this workflow` }, { status: 400 });
  const model = workflowModel(graph, firstModel());
  if (!model) return NextResponse.json({ error: 'INPUT_EMPTY', message: 'this workflow has no model', fix: 'choose one at the top of the agent panel' }, { status: 400 });
  void pruneKits();
  const files = (node.params.files ?? {}) as Record<string, string>;
  const profile = sample ? await readSample(sample) : null;
  try {
    return NextResponse.json(await startKitSession({ agentId: id, nodeId, request, files, model, ...(profile ? { sample: profile } : {}) }));
  } catch (e) {
    return NextResponse.json({ error: (e as { code?: string }).code ?? 'KIT_FAILED', message: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const session = new URL(req.url).searchParams.get('session') ?? '';
  const s = readKitSession(session);
  return s ? NextResponse.json(s) : NextResponse.json({ error: 'KIT_SESSION_NOT_FOUND' }, { status: 404 });
}

export async function DELETE(req: Request) {
  const session = new URL(req.url).searchParams.get('session') ?? '';
  return NextResponse.json({ cancelled: cancelKitSession(session) });
}
