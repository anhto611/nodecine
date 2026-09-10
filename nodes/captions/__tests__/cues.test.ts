import { describe, expect, it } from 'vitest';
import { buildCaptionTrack, retime, toCues } from '@/core/captions/cues';
import type { Word } from '@/core/types/payloads';

/** Evenly spaced words for a sentence, 0.3 s apart. */
const say = (text: string, from = 0): Word[] => text.split(/\s+/).map((w, i) => ({ text: w, start: from + i * 0.3, end: from + i * 0.3 + 0.25 }));

describe('toCues', () => {
  it('leaves a sentence that fits on one line whole', () => {
    expect(toCues(say('Nodes, not timelines.'), 26).map((c) => c.map((w) => w.text).join(' '))).toEqual(['Nodes, not timelines.']);
  });

  it('breaks at sentence ends before anything else', () => {
    const cues = toCues(say('Xin chào. Đây là NodeCine.'), 40);
    expect(cues.map((c) => c.map((w) => w.text).join(' '))).toEqual(['Xin chào.', 'Đây là NodeCine.']);
  });

  it('does not end a line on a glue word or split a spelled-out number', () => {
    const text = 'Có hai mươi lăm người và họ đều đến đúng giờ hôm nay.';
    const lines = toCues(say(text), 26).map((c) => c.map((w) => w.text));
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines.slice(0, -1)) expect(['và', 'hai', 'mươi']).not.toContain(line[line.length - 1]!.toLowerCase());
    for (const line of lines.slice(1)) expect(['mươi', 'lăm']).not.toContain(line[0]!.toLowerCase());
    expect(lines.flat().join(' ')).toBe(text);
  });

  it('keeps every line within the width unless a single word is wider', () => {
    const lines = toCues(say('Turn a repository link into a one minute vertical showcase with facts from GitHub.'), 22);
    for (const line of lines) expect(line.map((w) => w.text).join(' ').length).toBeLessThanOrEqual(22);
    expect(lines.length).toBeGreaterThan(2);
  });
});

describe('retime', () => {
  it('keeps the narration text and takes the timings by position when counts match', () => {
    const heard = say('xin chao day la');
    expect(retime('Xin chào, đây là', heard).map((w) => w.text)).toEqual(['Xin', 'chào,', 'đây', 'là']);
    expect(retime('Xin chào, đây là', heard)[1]).toMatchObject({ start: 0.3, end: 0.55 });
  });

  it('spreads the narration across the measured span when counts differ, longer words longer, never overlapping', () => {
    const words = retime('a beautiful day', say('a beau ti ful day'));
    expect(words.map((w) => w.text)).toEqual(['a', 'beautiful', 'day']);
    expect(words[0]!.start).toBe(0);
    expect(words[2]!.end).toBeCloseTo(1.45, 2);
    expect(words[1]!.end - words[1]!.start).toBeGreaterThan(words[0]!.end - words[0]!.start);
    expect(words[1]!.start).toBeGreaterThanOrEqual(words[0]!.end);
  });
});

describe('buildCaptionTrack', () => {
  it('holds a line briefly after its last word but never past the next line', () => {
    const track = buildCaptionTrack(say('Xin chào. Đây là NodeCine.'), { maxChars: 40 });
    expect(track.cues).toHaveLength(2);
    expect(track.cues[0]!.end).toBeLessThanOrEqual(track.cues[1]!.start);
    expect(track.cues[1]!.end).toBeCloseTo(track.cues[1]!.words.at(-1)!.end + 0.12, 3);
  });
});
