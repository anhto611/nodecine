import { NextResponse } from 'next/server';
import { workflows } from '@/server/contracts/workflows';

type Ctx = { params: Promise<{ id: string }> };
const fail = (e: unknown, status = 400) => NextResponse.json({ error: (e as { code?: string }).code ?? 'WORKFLOW_INVALID', message: e instanceof Error ? e.message : String(e) }, { status });

/** One workflow file: read it, replace it (rename, edit, autosave of `current`), or delete it. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const wf = await workflows.readWorkflow(id);
    return wf ? NextResponse.json(wf) : NextResponse.json({ error: 'WORKFLOW_NOT_FOUND' }, { status: 404 });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    const wf = workflows.toWorkflowFile({ ...(body ?? {}), id });
    await workflows.writeWorkflow(wf);
    return NextResponse.json(wf);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ deleted: await workflows.deleteWorkflow(id) });
  } catch (e) {
    return fail(e);
  }
}
