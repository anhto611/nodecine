import { describe, it, expect } from 'vitest';
import { allocateFrames, computeTotalFrames, framesFromSegments } from '../allocate';

describe('computeTotalFrames', () => {
  it('11.2s @30fps → 336 frames, no tail', () => {
    expect(computeTotalFrames(11.2, 30, 270)).toEqual({ total: 336, audioFrames: 336, padTailFrames: 0 });
  });
  it('7.5s @30fps → floor of 270, tail 45', () => {
    expect(computeTotalFrames(7.5, 30, 270)).toEqual({ total: 270, audioFrames: 225, padTailFrames: 45 });
  });
  it('rounds audio frames up', () => {
    expect(computeTotalFrames(10.001, 30, 0).audioFrames).toBe(301);
  });
});

describe('allocateFrames — invariants 3 and 4 over the whole range', () => {
  it('docs example: 336 × [1,2,1] → 84,168,84', () => {
    expect(allocateFrames(336, [1, 2, 1])).toEqual([84, 168, 84]);
  });
  it('docs example: 270 × [1,2,1] → 67,135,68', () => {
    expect(allocateFrames(270, [1, 2, 1])).toEqual([67, 135, 68]);
  });
  it('sum always matches and no scene is 0, for many weight sets and totals 270..3000', () => {
    const weightSets = [[1], [1, 1], [1, 2, 1], [3, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1], [0.5, 2.5], [7, 1]];
    for (const weights of weightSets) {
      for (let total = 270; total <= 3000; total++) {
        const out = allocateFrames(total, weights);
        expect(out.length).toBe(weights.length);
        expect(out.reduce((a, b) => a + b, 0)).toBe(total);
        expect(out.every((f) => f > 0)).toBe(true);
      }
    }
  });
  it('is deterministic', () => {
    expect(allocateFrames(999, [2, 3, 5])).toEqual(allocateFrames(999, [2, 3, 5]));
  });
  it('remainder given to the last scene is smaller than the scene count', () => {
    for (let total = 270; total <= 1000; total++) {
      const w = [1, 2, 1];
      const out = allocateFrames(total, w);
      const nominalLast = (total * 1) / 4;
      expect((out[2] as number) - nominalLast).toBeLessThan(w.length);
    }
  });
  it('rejects invalid input', () => {
    expect(() => allocateFrames(10, [])).toThrow();
    expect(() => allocateFrames(10, [1, 0])).toThrow();
    expect(() => allocateFrames(2, [1, 1, 1])).toThrow();
  });
});

describe('framesFromSegments', () => {
  it('gives each scene the frames of its narration and the last scene the remainder, padding included', () => {
    // 2.35 s, 3.35 s, 1.35 s at 30 fps → 71, 101 and whatever is left of a 270-frame minimum.
    expect(framesFromSegments(270, [{ durationSeconds: 2.35 }, { durationSeconds: 3.35 }, { durationSeconds: 1.35 }], 30)).toEqual([71, 101, 98]);
  });
  it('never lets a scene round to nothing, and takes frames back from the longest when the last would go negative', () => {
    expect(framesFromSegments(3, [{ durationSeconds: 0.01 }, { durationSeconds: 0.01 }, { durationSeconds: 0.01 }], 30)).toEqual([1, 1, 1]);
    // 9 + 9 frames asked of a 10-frame total: the last scene keeps one frame, taken back from the longest scenes in turn.
    expect(framesFromSegments(10, [{ durationSeconds: 0.3 }, { durationSeconds: 0.3 }, { durationSeconds: 0.01 }], 30)).toEqual([4, 5, 1]);
  });
});
