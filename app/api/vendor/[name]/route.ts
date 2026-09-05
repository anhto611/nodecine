import { isVendorName, vendorSource } from '@/engines/hyperframes/vendor.server';

/** Serves the two vendored scripts the browser player inlines into a composition; nothing else. */
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!isVendorName(name)) return new Response('not found', { status: 404 });
  const body = await vendorSource(name);
  return new Response(body, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=86400, immutable' } });
}
