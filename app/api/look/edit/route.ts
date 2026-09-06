import { NextResponse } from 'next/server';
import { createServerServices } from '@/server/services.server';
import { LookEditRequestSchema, editLook } from '@/nodes/art-director/edit.server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Rewrite a stage's or a block's code from an instruction, through the language model provider the
 * request names (the one wired in the workflow, or the default). Nothing is stored: the draft goes
 * back to the modal and the user decides.
 */
export async function POST(req: Request) {
  const parsed = LookEditRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request', issues: parsed.error.issues }, { status: 400 });
  const services = createServerServices();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), 240_000);
  req.signal.addEventListener('abort', () => ctrl.abort(req.signal.reason), { once: true });
  try {
    const ref = await services.probeLLM(parsed.data.providerId, parsed.data.settings);
    const blocked = Object.entries(ref.capabilities).find(([, c]) => typeof c === 'object' && c !== null && 'status' in c && (c as { status: string }).status === 'unavailable');
    if (blocked) {
      const c = blocked[1] as { code?: string; reason?: string; fix?: string };
      return NextResponse.json({ error: c.code ?? 'PROVIDER_NOT_CONNECTED', message: c.reason ?? `${ref.displayName} is not ready`, fix: c.fix }, { status: 409 });
    }
    const result = await editLook(parsed.data, (prompt, schema, signal) => services.complete(ref, prompt, schema, signal), ctrl.signal);
    return NextResponse.json({ ...result, provider: ref.displayName });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return NextResponse.json({ error: err.code ?? 'LLM_UPSTREAM', message: err.message ?? String(e) }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
