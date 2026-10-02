import { describe, expect, it } from 'vitest';
import { cutIntoScenes, sceneTitle } from '../scenes';
import type { Word } from '@/contracts/types/payloads';

/** Words as an aligner gives them: text, and when it was said. */
const say = (spec: string): Word[] =>
  spec
    .trim()
    .split(/\s+/)
    .map((piece) => {
      const [text, at, until] = piece.split('@')[0]!.length ? [piece.split('@')[0]!, ...piece.split('@')[1]!.split('-')] : ['', '0', '0'];
      return { text: text!, start: Number(at), end: Number(until) };
    });

const settings = { targetSeconds: 4, minSeconds: 1.5, pauseSeconds: 0.35 };

describe('cutting a recording into scenes', () => {
  it('cuts where the speech stops, in the silence and never through a word', () => {
    // Two thoughts: a pause of 0.6s at 5.0, another at 11.0.
    const words = say('Một@0-0.4 hai@0.5-1 ba@1.2-2 bốn@2.2-3 năm@3.2-4.4 sáu@4.5-5 bảy@5.6-6.4 tám@6.5-7.4 chín@7.5-8.6 mười@8.7-9.4 mười@9.5-10.4 một@10.5-11 hai@11.6-12.4');
    const scenes = cutIntoScenes(words, 13, settings);
    expect(scenes.map((s) => [s.start, s.durationSeconds])).toEqual([
      [0, 5.3],
      [5.3, 6],
      [11.3, 1.7],
    ]);
    // The first cut sits halfway through the 0.6s gap, so neither word is clipped.
    expect(scenes[0]!.said.endsWith('sáu')).toBe(true);
    expect(scenes[1]!.said.startsWith('bảy')).toBe(true);
    // Nothing is dropped and nothing is reordered: the scenes are the recording.
    expect(
      scenes
        .map((s) => s.said)
        .join(' ')
        .split(/\s+/),
    ).toHaveLength(words.length);
    expect(scenes.at(-1)!.start + scenes.at(-1)!.durationSeconds).toBe(13);
  });

  it('cuts anyway when somebody talks without breathing', () => {
    const words: Word[] = Array.from({ length: 40 }, (_, i) => ({ text: `w${i}`, start: i * 0.5, end: i * 0.5 + 0.45 }));
    const scenes = cutIntoScenes(words, 20, settings);
    expect(scenes.length).toBeGreaterThan(1);
    // Nothing runs away: the longest is held near twice the length asked for.
    expect(Math.max(...scenes.map((s) => s.durationSeconds))).toBeLessThanOrEqual(settings.targetSeconds * 1.8 + 0.6);
  });

  it('keeps a silent recording out of the film, and names a scene by what is said in it', () => {
    expect(cutIntoScenes([], 10, settings)).toEqual([]);
    expect(sceneTitle('Đi rõ cho em thấy ba cấp độ, được chứ?')).toBe('Đi rõ cho em thấy');
  });
});
