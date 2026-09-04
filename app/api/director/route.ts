import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureServerRegistrations } from '@/server/register';
import { getLLMProviderFactory } from '@/core/providers/registry';

const Body = z.object({
  providerId: z.string(),
  settings: z.record(z.string(), z.unknown()).default({}),
  prompt: z.string().min(1).max(64_000),
});

/**
 * One structured completion through the provider named by an LLMRef (CORE_CONTRACTS §7).
 * The server only guarantees "valid JSON object"; the calling node validates the shape, so
 * every pack can bring its own schema without the route knowing it.
 */
export async function POST(req: Request) {
  ensureServerRegistrations();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const { providerId, settings, prompt } = parsed.data;
  const f = getLLMProviderFactory(providerId);
  if (!f) return NextResponse.json({ error: 'PROVIDER_NOT_CONNECTED', message: `unknown llm provider ${providerId}` }, { status: 404 });
  try {
    const result = await f(settings).complete(prompt, z.record(z.string(), z.unknown()), req.signal);
    return NextResponse.json(result);
  } catch (e) {
    const err = e as { code?: string; message?: string; raw?: string };
    const isJsonError = e instanceof SyntaxError;
    const code = isJsonError ? 'LLM_SCHEMA_INVALID' : (err.code ?? 'LLM_UPSTREAM');
    const status = code === 'PROVIDER_NOT_INSTALLED' || code === 'PROVIDER_NOT_AUTHENTICATED' ? 409 : 502;
    return NextResponse.json({ error: code, message: err.message ?? String(e), details: err.raw ? { raw: err.raw.slice(0, 4000) } : null }, { status });
  }
}
