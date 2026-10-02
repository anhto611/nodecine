import { NextResponse } from 'next/server';
import { ensureServerRegistrations } from '@/server/contracts/register';
import { readTemplate } from '@/server/templates';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const template = await readTemplate(id, ensureServerRegistrations);
    return template ? NextResponse.json(template) : NextResponse.json({ error: 'TEMPLATE_NOT_FOUND' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: 'TEMPLATE_UNAVAILABLE', message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
