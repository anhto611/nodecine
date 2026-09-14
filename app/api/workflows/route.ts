import { NextResponse } from 'next/server';
import { CURRENT_WORKFLOW_ID } from '@/server/workflows';
import { workflows } from '@/server/contracts/workflows';

/** Workflows on disk, like ComfyUI's `/userdata/workflows`: list them, or save one (new or overwrite). */
export async function GET() {
  return NextResponse.json({ workflows: await workflows.listWorkflows() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  try {
    const wf = workflows.toWorkflowFile(body);
    if (wf.id === CURRENT_WORKFLOW_ID) return NextResponse.json({ error: 'WORKFLOW_ID_INVALID', message: 'that id is reserved' }, { status: 400 });
    await workflows.writeWorkflow(wf);
    return NextResponse.json(wf);
  } catch (e) {
    const code = (e as { code?: string }).code ?? 'WORKFLOW_INVALID';
    return NextResponse.json({ error: code, message: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
