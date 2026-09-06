import { exec, ExecError, findBinary } from './exec';

export async function ffmpegBin(): Promise<string | null> {
  return findBinary('ffmpeg', 'NODECINE_FFMPEG_BIN');
}

export async function ffprobeBin(): Promise<string | null> {
  const override = process.env.NODECINE_FFMPEG_BIN;
  if (override) return override.replace(/ffmpeg$/, 'ffprobe');
  return findBinary('ffprobe');
}

/** Measured from the produced file — never a provider estimate (CORE_CONTRACTS §2.5). */
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
