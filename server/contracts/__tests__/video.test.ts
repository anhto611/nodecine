import { describe, expect, it } from 'vitest';
import { needsRemaking, type ClipFacts } from '../video';

const clip = (over: Partial<ClipFacts> = {}): ClipFacts => ({
  durationSeconds: 227,
  width: 1080,
  height: 1920,
  fps: 30,
  hasAudio: true,
  codec: 'h264',
  keyframeSeconds: 1,
  ...over,
});

describe('whether a recording has to be made again before a film is cut from it', () => {
  it('leaves alone one a browser can play and seek into', () => {
    expect(needsRemaking(clip())).toBeNull();
    expect(needsRemaking(clip({ codec: 'vp9', keyframeSeconds: 2 }))).toBeNull();
  });

  it('remakes what no browser here plays, whatever its keyframes', () => {
    expect(needsRemaking(clip({ codec: 'hevc' }))).toBe('codec');
    expect(needsRemaking(clip({ codec: 'prores', keyframeSeconds: 0.1 }))).toBe('codec');
  });

  /*
   * The measured reason this rule exists: keyframes 8.3s apart cost a median 191ms a seek on this
   * machine and 333ms at worst, against 40ms at one second — six frozen frames at every scene change.
   */
  it('remakes one that cannot be seeked into without a stall', () => {
    expect(needsRemaking(clip({ keyframeSeconds: 8.333 }))).toBe('seeking');
    expect(needsRemaking(clip({ keyframeSeconds: 2.01 }))).toBe('seeking');
  });

  it('remakes one whose keyframes could not be found at all, rather than hope', () => {
    expect(needsRemaking(clip({ keyframeSeconds: Infinity }))).toBe('seeking');
  });

  /*
   * ffprobe calls every frame of a VP9 file a keyframe, so such a file always measures as seekable.
   * That is the right answer for the wrong reason, and it is here so the next person to read a
   * suspiciously perfect number knows it was noticed: VP9 seeks in a quarter of H.264s time anyway.
   */
  it('leaves a VP9 clip alone, which is what its unreadable keyframes would have said regardless', () => {
    expect(needsRemaking(clip({ codec: 'vp9', keyframeSeconds: 0.033 }))).toBeNull();
  });
});
