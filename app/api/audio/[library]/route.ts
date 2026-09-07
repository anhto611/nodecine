import { NextResponse } from 'next/server';
import { audioDir, isAudioLibrary, listAudio } from '@/server/paths';

/** What this machine holds for the pickers: names only, and the folder to drop files into. */
export async function GET(_req: Request, ctx: { params: Promise<{ library: string }> }) {
  const { library } = await ctx.params;
  if (!isAudioLibrary(library)) return NextResponse.json({ error: 'unknown library' }, { status: 404 });
  return NextResponse.json({ files: await listAudio(library), folder: audioDir(library) });
}
