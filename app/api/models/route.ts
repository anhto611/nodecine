import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getLLMProviderFactory } from '@/contracts/providers/registry';
import { ensureServerRegistrations } from '@/server/contracts/register';

const Body = z.object({ provider: z.string().min(1).max(60), settings: z.record(z.string(), z.unknown()).default({}) });

/**
 * What a workflow's model can do on this machine — installed, signed in, sees pictures, searches the
 * web — so the agent panel can say so before a run finds out. A probe only: nothing is asked of the model.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  ensureServerRegistrations();
  const factory = getLLMProviderFactory(parsed.data.provider);
  if (!factory) return NextResponse.json({ error: 'PROVIDER_NOT_CONNECTED', message: `unknown model ${parsed.data.provider}` }, { status: 404 });
  try {
    return NextResponse.json({ capabilities: await factory(parsed.data.settings).probe() });
  } catch (e) {
    return NextResponse.json({ error: 'PROVIDER_PROBE_FAILED', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
