import type { VideoIR } from '@/contracts/types/ir';

/**
 * The analysis JSON of every track that has one, by track id, through whatever can read a media
 * URL here — `fetch` in the browser, the file system in a render. A track whose analysis cannot be
 * read is left out: the scene's `nodecine.audio(id)` returns null and the scene guards it.
 */
export async function analysisOf(ir: Pick<VideoIR, 'audio'>, read: (url: string) => Promise<unknown>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  await Promise.all(ir.audio.filter((a) => a.analysisUrl).map(async (a) => {
    try { const json = await read(a.analysisUrl!); if (json) out[a.id] = json; } catch { /* left out */ }
  }));
  return out;
}
