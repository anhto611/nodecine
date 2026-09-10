import { ensureServerRegistrations } from '@/server/register';
import { hasVendorSource, vendorSource } from '@/server/vendor';

/** Serves the scripts the browser-side engines registered; nothing else. */
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  ensureServerRegistrations();
  const { name } = await ctx.params;
  if (!hasVendorSource(name)) return new Response('not found', { status: 404 });
  const body = await vendorSource(name);
  return new Response(body, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=86400, immutable' } });
}
