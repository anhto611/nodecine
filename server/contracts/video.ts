import path from 'node:path';
import { createHash } from 'node:crypto';
import { rename, stat } from 'node:fs/promises';
import { ErrorCode, NodeError } from '@/contracts/errors';
import { exec } from '@/server/exec';
import { assetPath, assetUrl, ensureTmpDir, fileNameFromAssetUrl, mediaPath, mediaUrl } from '@/server/paths';
import { ffprobeBin, ffmpegBin, measureDurationSeconds } from './audio';

/**
 * Recorded clips, read and taken apart on the server.
 *
 * A clip enters the workflow as an asset — a file named by the hash of its bytes, already on this
 * machine — and never as a path from the graph: everything here rebuilds the path from the hashed
 * name, the way the aligner does. What a clip turns out to be is measured with ffprobe, not taken from
 * whatever the graph claims, and its sound is pulled out as one MP3 so the aligner, the player and the
 * producer all meet the one format they are known to read.
 */

export interface ClipFacts {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  /** How the picture is coded. A phone films in HEVC, which no browser here can play. */
  codec: string;
  /**
   * The longest gap between two keyframes, in seconds. A film cut from a recording seeks into it at
   * every scene, and a seek has to decode from the keyframe before wherever it landed: a recording
   * with keyframes eight seconds apart freezes for a fifth of a second at every cut.
   */
  keyframeSeconds: number;
}

/** What the engine's browser can put on screen; anything else has to be made into one of these. */
const WEB_CODECS = new Set(['h264', 'vp8', 'vp9', 'av1']);

/**
 * Whether a clip has to be made again before a film can be cut from it — because no browser here can
 * play it, or because it cannot be seeked into without a visible stall.
 *
 * Measured, not guessed: on this machine a clip with keyframes 8.3s apart took a median 191ms to seek
 * and 333ms at worst, against 40ms for the same clip with keyframes a second apart. At thirty frames
 * a second that is six frozen frames at every scene change.
 */
export function needsRemaking(facts: ClipFacts): 'codec' | 'seeking' | null {
  if (!WEB_CODECS.has(facts.codec)) return 'codec';
  if (facts.keyframeSeconds > 2) return 'seeking';
  return null;
}

/** How much of a clip is read to find out how far apart its keyframes are. */
const WINDOW = 30;

const need = async (bin: 'ffmpeg' | 'ffprobe'): Promise<string> => {
  const found = bin === 'ffmpeg' ? await ffmpegBin() : await ffprobeBin();
  if (!found) throw new NodeError(ErrorCode.PROVIDER_NOT_INSTALLED, `${bin} was not found`, false).withFix('brew install ffmpeg');
  return found;
};

/** What the clip is: its size, how fast it runs, how long, and whether anything can be heard on it. */
export async function readClip(clipUrl: string, signal?: AbortSignal): Promise<ClipFacts> {
  const file = assetPath(fileNameFromAssetUrl(clipUrl));
  if (!(await stat(file).then((s) => s.isFile(), () => false))) {
    throw new NodeError(ErrorCode.INPUT_EMPTY, 'that clip is not on this machine any more', false).withFix('choose the clip again');
  }
  const bin = await need('ffprobe');
  const r = await exec(bin, {
    args: ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,avg_frame_rate:format=duration', '-of', 'json', file],
    timeoutMs: 60_000, signal,
  });
  if (r.code !== 0) throw new NodeError(ErrorCode.CLIP_UNREADABLE, `ffprobe could not read the clip: ${r.stderr.trim().slice(0, 200)}`);
  const probed = JSON.parse(r.stdout) as {
    streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number; avg_frame_rate?: string }[];
    format?: { duration?: string };
  };
  const video = (probed.streams ?? []).find((s) => s.codec_type === 'video') as { codec_name?: string; width?: number; height?: number; avg_frame_rate?: string } | undefined;
  if (!video?.width || !video.height) throw new NodeError(ErrorCode.CLIP_UNREADABLE, 'that file has no picture in it', false).withFix('choose a video file');
  const [num, den] = (video.avg_frame_rate ?? '30/1').split('/').map(Number);
  const duration = Number(probed.format?.duration ?? 0);
  if (!(duration > 0)) throw new NodeError(ErrorCode.CLIP_UNREADABLE, 'that clip has no length');
  return {
    durationSeconds: Math.round(duration * 1000) / 1000,
    width: video.width,
    height: video.height,
    fps: Math.round(((den ? (num ?? 30) / den : 30) || 30) * 1000) / 1000,
    hasAudio: (probed.streams ?? []).some((s) => s.codec_type === 'audio'),
    codec: String(video.codec_name ?? '').toLowerCase(),
    keyframeSeconds: await keyframeGap(bin, file, Math.round(duration * 1000) / 1000, signal),
  };
}

/**
 * How far apart this clip's keyframes are, read off its first half minute. Only the opening is read:
 * an encoder holds one interval for a whole file, and probing every frame of a long recording costs
 * more than the answer is worth. Finding only one keyframe does not mean the worst: a seek can never
 * cost more than decoding from the start, so a clip shorter than the window is only as bad as it is
 * long — which is why a two-second clip with a single keyframe is left alone and a three-minute one
 * with the same is not.
 *
 * The answer is only meaningful for H.264. ffprobe reports every frame of a VP9 file as a keyframe,
 * which would say such a file is perfectly seekable however it was made — and that turns out not to
 * matter, because it very nearly is: measured here, a VP9 clip seeks in 47ms against H.264's 191ms on
 * the same footage with the same keyframes. So the rule below bites on H.264, which is what needed it.
 */
async function keyframeGap(ffprobe: string, file: string, durationSeconds: number, signal?: AbortSignal): Promise<number> {
  const r = await exec(ffprobe, {
    args: ['-v', 'error', '-select_streams', 'v:0', '-skip_frame', 'nokey',
      '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', '-read_intervals', `%+${WINDOW}`, file],
    timeoutMs: 120_000, maxOutput: 1024 * 1024, signal,
  });
  if (r.code !== 0) return Math.min(durationSeconds, WINDOW);
  // Frame side data can add CSV columns (including a trailing comma). Blank lines are not time zero.
  const times = r.stdout.split(/\r?\n/).map((line) => line.split(',')[0]!.trim())
    .filter(Boolean).map(Number).filter((n) => Number.isFinite(n));
  // One keyframe in half a minute: the worst seek decodes everything up to it, capped by the window.
  if (times.length < 2) return Math.min(durationSeconds, WINDOW);
  let widest = 0;
  for (let i = 1; i < times.length; i++) widest = Math.max(widest, times[i]! - times[i - 1]!);
  return Math.round(widest * 1000) / 1000;
}

/**
 * The same clip in something every browser here can both play and seek into.
 *
 * A phone films in HEVC and holds the picture upright with a rotation tag; neither survives a browser
 * that only knows H.264 and takes pixels as they come. And a recording a film is cut from is seeked
 * into at every scene, so its keyframes are put a second apart — the twelve per cent it adds to the
 * file buys back five sixths of the stall at every cut. Either reason makes the copy; it is named by
 * the hash of the original, so it is only ever made once, and a clip that needs neither is handed
 * straight back.
 */
export async function webClip(clipUrl: string, facts: ClipFacts, signal?: AbortSignal): Promise<{ url: string; converted: boolean; why?: 'codec' | 'seeking' }> {
  const why = needsRemaking(facts);
  if (!why) return { url: clipUrl, converted: false };
  const source = assetPath(fileNameFromAssetUrl(clipUrl));
  // An asset is named by a hash and nothing else, so the copy gets its own, derived from the original's.
  // The suffix carries what this copy is for: when the rule changed, copies made under the old one
  // had to stop being found, or every clip already brought in would have kept its eight-second gaps.
  const name = `${createHash('sha1').update(`${fileNameFromAssetUrl(clipUrl)}:h264-seekable`).digest('hex')}.mp4`;
  const out = assetPath(name);
  if (!(await stat(out).then(() => true, () => false))) {
    const bin = await need('ffmpeg');
    const partial = `${out}.part.mp4`;
    const r = await exec(bin, {
      args: ['-v', 'error', '-y', '-i', source, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
        // A keyframe a second, and none of the extra ones a scene change would otherwise put in.
        '-g', '30', '-keyint_min', '30', '-sc_threshold', '0',
        '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', partial],
      timeoutMs: 60 * 60_000, signal,
    });
    if (r.code !== 0) throw new NodeError(ErrorCode.CLIP_UNREADABLE, `ffmpeg could not make that clip playable: ${r.stderr.trim().slice(0, 200)}`);
    await rename(partial, out);
  }
  return { url: assetUrl(name), converted: true, why };
}

/**
 * The clip's own sound, as one MP3 under the media directory. Named by the clip it came from, so the
 * same clip pulled apart twice costs nothing, and written under a temporary name first, so a run cut
 * short never leaves half a file whose name says it is whole.
 */
export async function clipAudio(clipUrl: string, signal?: AbortSignal): Promise<{ audioUrl: string; durationSeconds: number }> {
  const source = assetPath(fileNameFromAssetUrl(clipUrl));
  const name = `${fileNameFromAssetUrl(clipUrl).replace(/\.[a-z0-9]+$/, '').slice(0, 40)}.mp3`;
  const out = mediaPath(name);
  await ensureTmpDir();
  if (!(await stat(out).then(() => true, () => false))) {
    const bin = await need('ffmpeg');
    const partial = path.join(path.dirname(out), `${path.basename(out, '.mp3')}.part.mp3`);
    const r = await exec(bin, { args: ['-v', 'error', '-y', '-i', source, '-vn', '-ac', '1', '-ar', '44100', '-b:a', '128k', partial], timeoutMs: 15 * 60_000, signal });
    if (r.code !== 0) throw new NodeError(ErrorCode.CLIP_UNREADABLE, `ffmpeg could not read the clip's sound: ${r.stderr.trim().slice(0, 200)}`);
    await rename(partial, out);
  }
  return { audioUrl: mediaUrl(name), durationSeconds: await measureDurationSeconds(out, signal) };
}
