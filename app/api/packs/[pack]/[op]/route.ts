import { NextResponse } from 'next/server';
import { ensureServerRegistrations } from '@/server/register';
import { getPackHandler } from '@/core/packs/handlers';
import { NodeError } from '@/core/errors';

const SEGMENT = /^[a-z0-9-]{1,64}$/;

/** Generic pack RPC: POST /api/packs/<pack>/<op> with a JSON body, dispatched to the registered handler. */
export async function POST(req: Request, ctx: { params: Promise<{ pack: string; op: string }> }) {
  ensureServerRegistrations();
  const { pack, op } = await ctx.params;
  if (!SEGMENT.test(pack) || !SEGMENT.test(op)) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const handler = getPackHandler(pack, op);
  if (!handler) return NextResponse.json({ error: 'NODE_TYPE_UNKNOWN', message: `no handler for ${pack}/${op}` }, { status: 404 });
  const input: unknown = await req.json().catch(() => null);
  try {
    const result = await handler(input, req.signal);
    return NextResponse.json(result ?? null);
  } catch (e) {
    if (e instanceof NodeError) {
      const status = e.code === 'REPO_NOT_FOUND' ? 404 : e.code === 'REPO_RATE_LIMITED' ? 429 : 502;
      return NextResponse.json({ error: e.code, message: e.message, retryable: e.retryable, details: e.details ?? null }, { status });
    }
    return NextResponse.json({ error: 'PROVIDER_PROCESS_FAILED', message: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
