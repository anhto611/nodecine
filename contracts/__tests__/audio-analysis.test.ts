import { describe, expect, it } from 'vitest';
import { analyzeSamples, detectBeats, fft, pcm16ToFloat } from '../audio/analysis';

const tone = (hz: number, seconds: number, rate: number, gain = 0.8): Float32Array => {
  const out = new Float32Array(Math.round(seconds * rate));
  for (let i = 0; i < out.length; i++) out[i] = gain * Math.sin((2 * Math.PI * hz * i) / rate);
  return out;
};

describe('the audio analysis', () => {
  it('has one row per video frame, four values each, all within 0..1', () => {
    const a = analyzeSamples(tone(440, 2, 16000), 16000, 30);
    expect(a.frames).toHaveLength(60);
    expect(a.bands).toEqual(['level', 'bass', 'mid', 'high']);
    for (const row of a.frames) { expect(row).toHaveLength(4); for (const v of row) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); } }
  });

  it('puts a bass tone in the bass band and a high tone in the high band', () => {
    const rate = 16000;
    const low = analyzeSamples(tone(80, 1, rate), rate, 30);
    const high = analyzeSamples(tone(5000, 1, rate), rate, 30);
    // Peak-normalised per band, so compare the raw ratio through a mixed file instead: bass then treble.
    const mixed = new Float32Array(rate * 2);
    mixed.set(tone(80, 1, rate), 0);
    mixed.set(tone(5000, 1, rate), rate);
    const a = analyzeSamples(mixed, rate, 30);
    const first = a.frames[10]!;
    const second = a.frames[45]!;
    expect(first[1]).toBeGreaterThan(0.8);
    expect(first[3]).toBeLessThan(0.2);
    expect(second[3]).toBeGreaterThan(0.8);
    expect(second[1]).toBeLessThan(0.2);
    expect(low.frames[10]![0]!).toBeCloseTo(high.frames[10]![0]!, 1);
  });

  it('is silent for silence, and loud where the sound is', () => {
    const rate = 16000;
    const s = new Float32Array(rate);
    s.set(tone(440, 0.5, rate), Math.round(rate / 2));
    const a = analyzeSamples(s, rate, 30);
    expect(a.frames[3]![0]).toBe(0);
    expect(a.frames[25]![0]).toBeGreaterThan(0.9);
  });

  it('reads 16-bit little-endian PCM and transforms a power-of-two block', () => {
    const bytes = new Uint8Array([0x00, 0x40, 0x00, 0xc0]);
    expect(Array.from(pcm16ToFloat(bytes))).toEqual([0.5, -0.5]);
    const re = new Float32Array([1, 0, 0, 0, 0, 0, 0, 0]);
    const im = new Float32Array(8);
    fft(re, im);
    expect(Array.from(re).every((v) => Math.abs(v - 1) < 1e-6)).toBe(true);
  });
});

describe('where the beat falls', () => {
  /** A bass thump every half second: what a kick drum looks like to the analysis. */
  const pulses = (rate: number, seconds: number, every: number) => {
    const out = new Float32Array(Math.round(seconds * rate));
    for (let t = 0; t < seconds; t += every) {
      const at = Math.round(t * rate);
      for (let i = 0; i < rate * 0.08; i++) {
        const decay = 1 - i / (rate * 0.08);
        out[at + i] = 0.9 * decay * Math.sin((2 * Math.PI * 70 * i) / rate);
      }
    }
    return out;
  };

  it('finds the thumps, at the right seconds, not twice each', () => {
    const rate = 16000;
    const beats = detectBeats(analyzeSamples(pulses(rate, 4, 0.5), rate, 30));
    expect(beats.length).toBeGreaterThanOrEqual(6);
    expect(beats.length).toBeLessThanOrEqual(9);
    // Each lands within two frames of a half-second mark: the analysis window is 32 ms wide, so a
    // thump is seen by the frame it starts in or the next one, and no closer than that.
    for (const b of beats) expect(Math.abs(b - Math.round(b * 2) / 2), `${b}s is not on a half second`).toBeLessThan(2.5 / 30);
  });

  it('finds nothing in silence or in a steady tone, and nothing in an empty analysis', () => {
    const rate = 16000;
    expect(detectBeats(analyzeSamples(new Float32Array(rate * 2), rate, 30))).toEqual([]);
    const steady = new Float32Array(rate * 2);
    for (let i = 0; i < steady.length; i++) steady[i] = 0.5 * Math.sin((2 * Math.PI * 80 * i) / rate);
    expect(detectBeats(analyzeSamples(steady, rate, 30)).length).toBeLessThanOrEqual(1);
    expect(detectBeats({ fps: 30, frames: [] })).toEqual([]);
  });
});
