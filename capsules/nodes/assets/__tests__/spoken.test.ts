import { describe, expect, it } from 'vitest';
import type { Voiceover } from '@/contracts/types/payloads';
import { BriefSchema } from '@/contracts/types/brief';
import { spokenBrief } from '../spoken';

const said = (text: string, language = 'vi'): Voiceover => ({
  audioUrl: '/api/media/aaaaaaaaaaaaaaaa.mp3',
  durationSeconds: 10,
  voiceName: 'clip',
  language,
  speed: 1,
  words: text.split(' ').map((w, i) => ({ text: w, start: i * 0.3, end: i * 0.3 + 0.28 })),
});

describe('what a film that has already been shot is about', () => {
  it('is its own words, in the language they were heard in', () => {
    const brief = spokenBrief(said('Đầu tiên là cấp độ gà mờ'))!;
    expect(brief.about).toBe('Đầu tiên là cấp độ gà mờ');
    expect(brief.language).toBe('vi');
    expect(BriefSchema.parse(brief)).toEqual(brief);
  });

  it('reads the language off the words when nobody wrote one down', () => {
    expect(spokenBrief(said('Đầu tiên là cấp độ gà mờ, chỗ này mình sẽ làm một phép so sánh', 'und'))!.language).toBe('vi');
  });

  it('is nothing at all when nothing was said', () => {
    expect(spokenBrief({ ...said('x'), words: [] })).toBeUndefined();
    expect(spokenBrief({ ...said('x'), words: undefined })).toBeUndefined();
  });

  it('keeps the opening and the close when the talk is longer than a brief may hold', () => {
    const long = `opening ${'middle '.repeat(600)}closing`;
    const brief = spokenBrief(said(long))!;
    expect(brief.about.length).toBeLessThanOrEqual(3000);
    expect(brief.about.startsWith('opening')).toBe(true);
    expect(brief.about.endsWith('closing')).toBe(true);
    expect(brief.about).toContain(' … ');
    expect(BriefSchema.parse(brief)).toEqual(brief);
  });
});
