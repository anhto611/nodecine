import path from 'node:path';
import { stat } from 'node:fs/promises';
import { exec, ExecError } from '@/server/exec';
import { ffmpegBin, importLibraryAudio, measureDurationSeconds } from '@/server/audio';
import { contentHash } from '@/core/hash';
import { libraryPath, ensureTmpDir, fileNameFromMediaUrl, mediaPath, mediaUrl } from '@/server/paths';
import type { MixAudioOptions, MixResult } from './types';

/**
 * A music bed under the voice (CORE_CONTRACTS §5.15).
 *
 * The bed is looped to the length of the voice, faded at both ends, and pushed down while the voice
 * speaks — `sidechaincompress` listens to the voice and turns the music down, which is what a radio
 * desk does and what the ear expects. The mix ends exactly when the voice does (`duration=first`),
 * so every frame the assembler already counted still lines up.
 */
export async function mixAudioOnServer(voiceoverUrl: string, opts: MixAudioOptions, signal: AbortSignal): Promise<MixResult> {
  const bin = await ffmpegBin();
  if (!bin) throw new Error('ffmpeg not found');
  const voice = mediaPath(fileNameFromMediaUrl(voiceoverUrl));
  const track = libraryPath('music', opts.track);
  if (!(await exists(track))) throw new Error(`no track named "${opts.track}" in the music folder`);

  const seconds = await measureDurationSeconds(voice, signal);
  const name = `${contentHash({ voice: path.basename(voice), ...opts })}.mp3`;
  const out = path.join(await ensureTmpDir(), name);
  if (await exists(out)) return { audioUrl: mediaUrl(name), durationSeconds: await measureDurationSeconds(out, signal) };

  const r = await exec(bin, {
    args: ['-y', '-v', 'error', '-i', voice, '-i', track, '-filter_complex', mixFilter(seconds, opts), '-map', '[out]', '-codec:a', 'libmp3lame', '-q:a', '2', '-f', 'mp3', out],
    timeoutMs: 5 * 60_000,
    signal,
  });
  if (r.code !== 0) throw new ExecError(`ffmpeg could not mix the music: ${r.stderr.trim()}`, r);
  return { audioUrl: mediaUrl(name), durationSeconds: await measureDurationSeconds(out, signal) };
}

/** Kept separate from the subprocess so a test can read the recipe without ffmpeg on the machine. */
export function mixFilter(seconds: number, opts: MixAudioOptions): string {
  const fadeIn = Math.min(opts.fadeInSeconds, seconds / 2);
  const fadeOut = Math.min(opts.fadeOutSeconds, seconds - fadeIn);
  // How hard the voice pushes the bed down: duck 0 leaves it alone, duck 1 flattens it.
  const ratio = 1 + opts.duck * 19;
  const bed = [
    `[1:a]aloop=loop=-1:size=2147483647,atrim=0:${seconds.toFixed(3)},asetpts=N/SR/TB`,
    `,volume=${opts.volume.toFixed(3)}`,
    fadeIn > 0 ? `,afade=t=in:st=0:d=${fadeIn.toFixed(2)}` : '',
    fadeOut > 0 ? `,afade=t=out:st=${(seconds - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(2)}` : '',
    '[bed]',
  ].join('');
  // `normalize=0`, or amix halves both sides and the voice comes out quiet.
  const mix = '[voice][under]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]';
  if (opts.duck <= 0) return `${bed};[0:a]anull[voice];[bed]anull[under];${mix}`;
  return `${bed};[0:a]asplit=2[voice][key];[bed][key]sidechaincompress=threshold=0.03:ratio=${ratio.toFixed(1)}:attack=20:release=400[under];${mix}`;
}

const exists = (p: string) => stat(p).then(() => true, () => false);

/** The bed as a file of its own, for the track output. */
export const importMusicOnServer = (fileName: string, signal: AbortSignal) => importLibraryAudio('music', fileName, signal);

export const audioMixServices = { 'audio-mix/mix': mixAudioOnServer, 'audio-mix/import': importMusicOnServer };
