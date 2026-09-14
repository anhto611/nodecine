import { describe, expect, it } from 'vitest';
import { safeFileName } from '../file-name';

describe('safeFileName', () => {
  it('keeps the words a person actually typed, in any script', () => {
    expect(safeFileName('phụ đề của tôi', 'x', 'srt')).toBe('phụ đề của tôi.srt');
    expect(safeFileName('Bản Tin AI #5 - tập 2', 'x', 'mp4')).toBe('Bản Tin AI #5 - tập 2.mp4');
  });

  it('removes only what a filesystem or a header refuses, and collapses the gap it leaves', () => {
    expect(safeFileName('a/b|c?d"e<f>g:h*i', 'x')).toBe('a b c d e f g h i');
    expect(safeFileName('tab\there', 'x')).toBe('tab here');
  });

  it('never yields a hidden file, a trailing dot, or an empty name', () => {
    expect(safeFileName('  ..hidden..  ', 'x')).toBe('hidden');
    expect(safeFileName('///', 'nodecine', 'srt')).toBe('nodecine.srt');
    expect(safeFileName('', 'nodecine')).toBe('nodecine');
  });

  it('caps a very long name', () => {
    expect(safeFileName('a'.repeat(200), 'x').length).toBe(80);
  });
});
