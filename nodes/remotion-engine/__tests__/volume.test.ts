import { describe, expect, it } from 'vitest';
import { volumeOf } from '../Video';
import type { AudioTrack } from '@/core/types/ir';

const music: AudioTrack = { id: 'music-1', role: 'music', url: '/api/media/0000000000000001.mp3', startFrame: 0, durationInFrames: 300, gain: 0.2, fadeInSeconds: 1, fadeOutSeconds: 2, duck: { by: 'voice', to: 0.05 } };

describe('a Remotion audio track\'s level', () => {
  it('is a number when nothing shapes it', () => {
    expect(volumeOf({ ...music, fadeInSeconds: undefined, fadeOutSeconds: undefined, duck: undefined }, 30)).toBe(0.2);
  });

  it('ramps in, holds, ramps out', () => {
    const v = volumeOf({ ...music, duck: undefined }, 30) as (f: number) => number;
    expect(v(0)).toBe(0);
    expect(v(15)).toBeCloseTo(0.1);
    expect(v(150)).toBeCloseTo(0.2);
    expect(v(270)).toBeCloseTo(0.1);
    expect(v(300)).toBe(0);
  });

  it('dips to the duck level while the voice speaks, with a lead before the first word and a tail after the last', () => {
    const v = volumeOf(music, 30, [{ startFrame: 90, endFrame: 150 }]) as (f: number) => number;
    expect(v(60)).toBeCloseTo(0.2);
    expect(v(120)).toBeCloseTo(0.05);
    // Halfway down the lead ramp, and halfway back up the tail.
    expect(v(90 - 5 - 4)).toBeGreaterThan(0.05);
    expect(v(90 - 5 - 4)).toBeLessThan(0.2);
    expect(v(150 + 6)).toBeCloseTo(0.125, 1);
    expect(v(200)).toBeCloseTo(0.2);
  });
});
