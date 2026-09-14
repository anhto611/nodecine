import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runNodeAction } from '@/server/contracts/actions';

const Body = z.object({ args: z.array(z.unknown()).max(20) });

/** A node body's action (`capsule/name`), with its arguments; answers with what the action returned. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string[] }> }) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  try {
    return NextResponse.json({ result: await runNodeAction(id.join('/'), parsed.data.args) });
  } catch (e) {
    const code = (e as { code?: string }).code ?? 'ACTION_FAILED';
    return NextResponse.json({ error: code, message: e instanceof Error ? e.message : String(e) }, { status: code === 'ACTION_UNKNOWN' ? 404 : 400 });
  }
}
