import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureServerRegistrations } from '@/server/register';
import { getLLMProviderFactory, getTTSProviderFactory } from '@/core/providers/registry';
import { getEngineFactory } from '@/core/adapters/registry';
import { makeEngineRef } from '@/core/adapters/types';
import { buildTTSRef } from '@/providers/system-tts';

const Body = z.object({
  kind: z.enum(['llm', 'tts', 'engine']),
  id: z.string().min(1),
  settings: z.record(z.string(), z.unknown()).default({}),
});

/** probe() for resource nodes (EXECUTION_ENGINE §1.1). Never 500s for "unavailable" — that is a valid answer. */
export async function POST(req: Request) {
  ensureServerRegistrations();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const { kind, id, settings } = parsed.data;
  try {
    if (kind === 'llm') {
      const f = getLLMProviderFactory(id);
      if (!f) return NextResponse.json({ error: `unknown llm provider ${id}` }, { status: 404 });
      const p = f(settings);
      const capabilities = await p.probe();
      return NextResponse.json({ providerId: p.providerId, displayName: p.displayName, transport: p.transport, capabilities, settings });
    }
    if (kind === 'tts') {
      const f = getTTSProviderFactory(id);
      if (!f) return NextResponse.json({ error: `unknown tts provider ${id}` }, { status: 404 });
      const p = f(settings);
      return NextResponse.json(buildTTSRef(p, await p.probe(), settings));
    }
    const f = getEngineFactory(id);
    if (!f) return NextResponse.json({ error: `unknown engine ${id}` }, { status: 404 });
    const a = f(settings);
    return NextResponse.json(makeEngineRef(a, await a.probe(), settings));
  } catch (e) {
    return NextResponse.json({ error: 'PROVIDER_PROBE_FAILED', message: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
