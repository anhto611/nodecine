import path from 'node:path';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { convertToMp3, measureDurationSeconds } from '@/server/audio';
import { libraryPath, ensureTmpDir, mediaPath, mediaUrl } from '@/server/paths';

/**
 * Somebody's own recording, brought into a run (CORE_CONTRACTS §5.17).
 *
 * The file stays in their folder; what enters the graph is a copy under the media directory, named
 * by the hash of the bytes and re-encoded to MP3, so the player, the producer and the aligner all
 * meet the one format they are known to read — and re-importing the same take costs nothing.
 */
export async function importAudioOnServer(fileName: string, signal: AbortSignal): Promise<{ audioUrl: string; durationSeconds: number }> {
  const source = libraryPath('voice', fileName);
  if (!(await stat(source).then((s) => s.isFile(), () => false))) {
    throw new Error(`no recording named "${fileName}" in the voice folder`);
  }
  const name = `${await hashFile(source)}.mp3`;
  const out = mediaPath(name);
  await ensureTmpDir();
  if (!(await stat(out).then(() => true, () => false))) {
    // Convert into place under a temporary name, so an interrupted run never leaves a half file
    // that the hash says is complete.
    const partial = path.join(path.dirname(out), `${path.basename(out, '.mp3')}.part.mp3`);
    await convertToMp3(source, partial, signal);
    const { rename } = await import('node:fs/promises');
    await rename(partial, out);
  }
  return { audioUrl: mediaUrl(name), durationSeconds: await measureDurationSeconds(out, signal) };
}

/** The file's own bytes, read as a stream: a two-hour recording must not have to fit in memory. */
async function hashFile(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex').slice(0, 16);
}

export const audioInputServices = { 'audio-input/import': importAudioOnServer };
