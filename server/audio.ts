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
