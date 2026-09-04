import { NextResponse } from 'next/server';

/** Phase B: LLM completion via the pack's director node. Stubbed until packs/github-showcase lands. */
export async function POST() {
  return NextResponse.json({ error: 'NOT_IMPLEMENTED', message: 'Director endpoint arrives with Phase B' }, { status: 501 });
}
