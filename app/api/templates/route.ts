import { NextResponse } from 'next/server';
import { ensureServerRegistrations } from '@/server/contracts/register';
import { listTemplates } from '@/server/templates';

export async function GET() {
  try {
    return NextResponse.json({ templates: await listTemplates(ensureServerRegistrations) });
  } catch (error) {
    return NextResponse.json({ error: 'TEMPLATE_UNAVAILABLE', message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
