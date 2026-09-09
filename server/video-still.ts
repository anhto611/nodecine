import { createHash } from 'node:crypto';
import path from 'node:path';
import { rename, stat } from 'node:fs/promises';
import { exec } from './exec';
import { ffmpegBin } from './audio';
import { assetPath, assetUrl, ensureAssetsDir } from './paths';

/**
 * One frame of a clip, kept as an image asset (CORE_CONTRACTS §5.18).
 *
 * This is not "use a video frame as the thumbnail" — every platform already lets a person scrub for
 * that. It is the **ground** a designed cover is drawn on: the film's own footage under the title,
 * so a template whose footage changes every run gets a cover that belongs to that run without
 * anybody opening a picker afterwards.
 *
 * Named by the clip and the second, so the same frame asked for twice is one file on disk.
 */
export async function stillFromVideo(clipName: string, atSeconds: number, signal?: AbortSignal): Promise<string> {
  const source = assetPath(clipName);
  const at = Math.max(0, atSeconds);
  const name = `${createHash('sha1').update(`${clipName}@${at}`).digest('hex')}.jpg`;
  const dir = await ensureAssetsDir();
  const target = path.join(dir, name);
  if (await stat(target).then((s) => s.size > 0, () => false)) return assetUrl(name);

  const bin = await ffmpegBin();
  if (!bin) throw Object.assign(new Error('ffmpeg was not found, so a frame cannot be taken from the clip'), { code: 'PROVIDER_NOT_INSTALLED' });
  const tmp = `${target}.${process.pid}.part.jpg`;
  // `-ss` before `-i` seeks by keyframe, which is fast and exact enough for a still; `-frames:v 1`
  // takes one picture and stops, so a long clip costs the same as a short one.
  const r = await exec(bin, {
    args: ['-y', '-v', 'error', '-ss', String(at), '-i', source, '-frames:v', '1', '-q:v', '2', '-f', 'image2', tmp],
    timeoutMs: 60_000,
    signal,
  });
  if (r.code !== 0) throw new Error(`ffmpeg could not take a frame from the clip: ${r.stderr.trim()}`);
  const s = await stat(tmp).catch(() => null);
  if (!s || s.size === 0) throw new Error('ffmpeg wrote an empty picture');
  await rename(tmp, target);
  return assetUrl(name);
}
