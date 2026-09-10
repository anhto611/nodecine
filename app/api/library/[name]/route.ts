import { NextResponse } from 'next/server';
import { ensureServerRegistrations } from '@/server/register';
import { isLibrary, libraryDir, listLibrary } from '@/server/paths';

/** What this machine holds for the pickers: names only, and the folder to drop files into. */
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  ensureServerRegistrations();
  const { name } = await ctx.params;
  if (!isLibrary(name)) return NextResponse.json({ error: 'unknown library' }, { status: 404 });
  return NextResponse.json({ files: await listLibrary(name), folder: libraryDir(name) });
}
