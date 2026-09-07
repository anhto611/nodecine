import { NextResponse } from 'next/server';
import { listMusic, musicDir } from '@/server/paths';

/** The tracks this machine holds, for the Audio Mix node's picker. Names only; the files never move. */
export async function GET() {
  return NextResponse.json({ tracks: await listMusic(), folder: musicDir() });
}
