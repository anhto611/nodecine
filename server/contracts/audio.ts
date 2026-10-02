import path from 'node:path';
import { createReadStream } from 'node:fs';
import { rename, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { exec, ExecError, findBinary } from '@/server/exec';
import { ensureTmpDir, mediaPath, mediaUrl } from '@/server/paths';

export async function ffmpegBin(): Promise<string | null> {
  return findBinary('ffmpeg', 'NODECINE_FFMPEG_BIN');
}

export async function ffprobeBin(): Promise<string | null> {
  const override = process.env.NODECINE_FFMPEG_BIN;
  if (override) return override.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
  return findBinary('ffprobe');
}

/** Measured from the produced file — never a provider estimate. */
export async function measureDurationSeconds(filePath: string, signal?: AbortSignal): Promise<number> {
  const bin = await ffprobeBin();
  if (!bin) throw new Error('ffprobe not found');
  const r = await exec(bin, {
    args: ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath],
    timeoutMs: 15_000,
    signal,
  });
  const seconds = Number.parseFloat(r.stdout.trim());
  if (r.code !== 0 || !Number.isFinite(seconds) || seconds <= 0) {
    throw new ExecError(`ffprobe could not read duration: ${r.stderr.trim()}`, r);
  }
  return Math.round(seconds * 100) / 100;
}

/**
 * Join MP3s in order with `gapSeconds` of silence after each one. `apad` pads every input, so the
 * last part ends on the same pause as the others and the file's length is the sum the caller expects.
 */
export async function concatMp3(inputs: string[], gapSeconds: number, output: string, signal?: AbortSignal): Promise<void> {
  const bin = await ffmpegBin();
  if (!bin) throw new Error('ffmpeg not found');
  if (inputs.length === 0) throw new Error('nothing to join');
  const pads = inputs.map((_, i) => `[${i}:a]apad=pad_dur=${gapSeconds}[p${i}]`).join(';');
  const filter = `${pads};${inputs.map((_, i) => `[p${i}]`).join('')}concat=n=${inputs.length}:v=0:a=1[out]`;
  const r = await exec(bin, {
    args: ['-y', '-v', 'error', ...inputs.flatMap((f) => ['-i', f]), '-filter_complex', filter, '-map', '[out]', '-codec:a', 'libmp3lame', '-q:a', '2', '-f', 'mp3', output],
    timeoutMs: 120_000,
    signal,
  });
  if (r.code !== 0) throw new ExecError(`ffmpeg failed: ${r.stderr.trim()}`, r);
}

export async function convertToMp3(input: string, output: string, signal?: AbortSignal): Promise<void> {
  const bin = await ffmpegBin();
  if (!bin) throw new Error('ffmpeg not found');
  const r = await exec(bin, {
    args: ['-y', '-v', 'error', '-i', input, '-codec:a', 'libmp3lame', '-q:a', '2', '-f', 'mp3', output],
    timeoutMs: 60_000,
    signal,
  });
  if (r.code !== 0) throw new ExecError(`ffmpeg failed: ${r.stderr.trim()}`, r);
}

/**
 * An audio file from this machine, brought into a run. The file stays where it is; what enters the
 * graph is a copy under the media directory, named by the hash of the bytes and re-encoded to MP3,
 * so the player, the producer and the aligner all meet the one format they are known to read — and
 * importing the same file twice costs nothing. The caller decides which paths may be read.
 */
export async function importAudioFile(source: string, signal: AbortSignal): Promise<{ audioUrl: string; durationSeconds: number }> {
  if (
    !(await stat(source).then(
      (s) => s.isFile(),
      () => false,
    ))
  ) {
    throw new Error(`no audio file at "${source}"`);
  }
  const name = `${await hashFile(source)}.mp3`;
  const out = mediaPath(name);
  await ensureTmpDir();
  if (
    !(await stat(out).then(
      () => true,
      () => false,
    ))
  ) {
    // Convert into place under a temporary name, so an interrupted run never leaves a half file
    // that the hash says is complete.
    const partial = path.join(path.dirname(out), `${path.basename(out, '.mp3')}.part.mp3`);
    await convertToMp3(source, partial, signal);
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
