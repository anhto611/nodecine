import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { LLMImage } from '@/contracts/providers/types';
import { exec, findBinary } from '@/server/exec';

/**
 * What the providers that look at pictures share: each picture fitted within IMAGE_LONG_SIDE and
 * written as JPEG into the call's own directory, when ffmpeg is there to do it. A phone screenshot as
 * PNG can be several megabytes, past what one message takes; the model reads this size at full detail.
 */

export const IMAGE_LONG_SIDE = 1568;

/** The pictures as files to send: fitted copies in `dir`, or the originals when they cannot be made. */
export async function fittedImages(images: LLMImage[], dir: string, signal: AbortSignal): Promise<LLMImage[]> {
  const ffmpeg = await findBinary('ffmpeg', 'NODECINE_FFMPEG_BIN');
  return Promise.all(images.map(async (image, i) => {
    if (!ffmpeg || image.mediaType === 'image/svg+xml') return image;
    const out = path.join(dir, `image-${i}.jpg`);
    const fit = `scale='if(gt(iw,ih),min(${IMAGE_LONG_SIDE},iw),-2)':'if(gt(iw,ih),-2,min(${IMAGE_LONG_SIDE},ih))'`;
    const r = await exec(ffmpeg, { args: ['-v', 'error', '-y', '-i', image.path, '-vf', fit, '-q:v', '3', out], timeoutMs: 30_000, signal }).catch(() => null);
    return r && r.code === 0 ? { path: out, mediaType: 'image/jpeg' } : image;
  }));
}

/** A picture's bytes as base64, for an API that takes them inline. */
export const base64Of = async (image: LLMImage): Promise<string> => (await readFile(image.path)).toString('base64');
