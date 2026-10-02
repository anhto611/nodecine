import { describe, expect, it } from 'vitest';
import { timecode, toSubtitles } from '../subtitles';
import type { CaptionTrack } from '@/contracts/types/payloads';

const w = (text: string, start: number, end: number) => ({ text, start, end });
const track: CaptionTrack = {
  cues: [
    { start: 0, end: 1.5, words: [w('Xin', 0, 0.4), w('chào', 0.5, 1.5)] },
    { start: 1.62, end: 3.004, words: [w('thế', 1.62, 2), w('giới', 2.1, 3.004)] },
  ],
};

describe('timecode', () => {
  it('always writes hours, and marks the decimal the way each format asks', () => {
    expect(timecode(0, 'srt')).toBe('00:00:00,000');
    expect(timecode(0, 'vtt')).toBe('00:00:00.000');
    expect(timecode(3661.5, 'srt')).toBe('01:01:01,500');
    expect(timecode(3.004, 'vtt')).toBe('00:00:03.004');
  });
  it('never goes negative', () => {
    expect(timecode(-2, 'srt')).toBe('00:00:00,000');
  });
});

describe('toSubtitles', () => {
  it('numbers SubRip cues and ends on a newline', () => {
    expect(toSubtitles(track, 'srt')).toBe('1\n00:00:00,000 --> 00:00:01,500\nXin chào\n\n2\n00:00:01,620 --> 00:00:03,004\nthế giới\n');
  });

  it('gives WebVTT its header and drops the numbering', () => {
    expect(toSubtitles(track, 'vtt')).toBe('WEBVTT\n\n00:00:00.000 --> 00:00:01.500\nXin chào\n\n00:00:01.620 --> 00:00:03.004\nthế giới\n');
  });

  it('gives a cue with no length a visible instant, so a player cannot drop it', () => {
    const out = toSubtitles({ cues: [{ start: 2, end: 2, words: [w('hử', 2, 2)] }] }, 'srt');
    expect(out).toContain('00:00:02,000 --> 00:00:02,040');
  });
});
