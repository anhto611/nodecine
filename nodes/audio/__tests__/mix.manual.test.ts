import { describe, expect, it } from 'vitest';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { createServerServices } from '@/server/services.server';
import { audioDir, ensureTmpDir, fileNameFromMediaUrl, mediaPath, mediaUrl } from '@/server/paths';
import { measureDurationSeconds } from '@/server/audio';

/**
 * Manual: a real ffmpeg mix. Enable with NODECINE_MANUAL_MIX=1 and point NODECINE_MANUAL_VOICE at
 * an mp3 (any path) and NODECINE_MANUAL_TRACK at a music file (any path); both are copied in for
 * the run. Prints the mixed file's path.
 */
const enabled = process.env.NODECINE_MANUAL_MIX === '1';

describe.skipIf(!enabled)('the music bed, for real', () => {
  it('comes out exactly as long as the voice', async () => {
    const voiceSrc = process.env.NODECINE_MANUAL_VOICE!;
    const trackSrc = process.env.NODECINE_MANUAL_TRACK!;
    const voiceName = 'aaaaaaaaaaaaaaaa.mp3';
    await copyFile(voiceSrc, path.join(await ensureTmpDir(), voiceName));
    await mkdir(audioDir('music'), { recursive: true });
    const trackName = 'Manual Test Track.mp3';
    await copyFile(trackSrc, path.join(audioDir('music'), trackName));
    try {
      const voiceSeconds = await measureDurationSeconds(mediaPath(voiceName));
      const out = await createServerServices().mixAudio(mediaUrl(voiceName), { track: trackName, volume: 0.16, duck: 0.7, fadeInSeconds: 1, fadeOutSeconds: 2 }, new AbortController().signal);
      console.log('mixed →', mediaPath(fileNameFromMediaUrl(out.audioUrl)));
      expect(Math.abs(out.durationSeconds - voiceSeconds)).toBeLessThan(0.15);
    } finally {
      await rm(path.join(audioDir('music'), trackName), { force: true });
    }
  }, 120_000);
});
