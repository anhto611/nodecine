import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GraphSchema } from '@/core/templates/registry';
import { GraphInvalidError } from '@/core/engine/graph';
import { jobHub } from '@/server/jobs';

const Body = z.object({
  key: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  kind: z.enum(['run', 'node', 'probe']),
  graph: GraphSchema,
  name: z.string().max(200).optional(),
  nodeId: z.string().optional(),
  force: z.boolean().optional(),
  /** The browser's id for this submission; a retry of the same one gets the same job back. */
  requestId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).optional(),
});

/** Submit a job (like ComfyUI's POST /prompt) or list recent ones. An invalid graph is refused with its issues. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request', issues: parsed.error.issues }, { status: 400 });
  try {
    const job = jobHub().submit(parsed.data);
    return NextResponse.json({ job });
  } catch (e) {
    // Matched by shape, not instanceof: in dev the hub outlives a hot reload and throws the class from the previous module graph.
    const issues = (e as { issues?: unknown }).issues;
    if (e instanceof GraphInvalidError || (e instanceof Error && e.name === 'GraphInvalidError' && Array.isArray(issues))) return NextResponse.json({ error: 'GRAPH_INVALID', message: e.message, issues }, { status: 400 });
    return NextResponse.json({ error: (e as { code?: string }).code ?? 'JOB_INVALID', message: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ jobs: jobHub().list() });
}
