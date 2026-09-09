import { describe, expect, it } from 'vitest';
import { splitScript } from '../split';

describe('splitScript', () => {
  it('takes a blank line as the scene break, and folds the wrapping inside one', () => {
    expect(splitScript('Câu một.\nvẫn cảnh một.\n\n\nCâu hai.', 'blank-line')).toEqual(['Câu một. vẫn cảnh một.', 'Câu hai.']);
  });

  it('takes one line per scene for a list pasted from notes', () => {
    expect(splitScript('Một\nHai\n\nBa', 'line')).toEqual(['Một', 'Hai', 'Ba']);
  });

  it('cuts a dense paragraph at its sentences', () => {
    expect(splitScript('Mỗi cảnh là một tấm hình. Gõ lời thoại rồi bấm chạy! Thế thôi?', 'sentence'))
      .toEqual(['Mỗi cảnh là một tấm hình.', 'Gõ lời thoại rồi bấm chạy!', 'Thế thôi?']);
  });

  it('changes not one word of what was pasted, beyond the spacing it folds', () => {
    const text = 'Ổ khoá, Ặc ặc — “trích dẫn” và dấu ba chấm…\n\nCâu sau.';
    expect(splitScript(text, 'blank-line').join(' ')).toBe('Ổ khoá, Ặc ặc — “trích dẫn” và dấu ba chấm… Câu sau.');
  });

  it('is empty for empty input, and drops blank chunks rather than making blank scenes', () => {
    expect(splitScript('   \n\n  ', 'blank-line')).toEqual([]);
    expect(splitScript('Một\n\n\n\nHai', 'blank-line')).toEqual(['Một', 'Hai']);
  });

  it('handles Windows line endings', () => {
    expect(splitScript('Một\r\n\r\nHai', 'blank-line')).toEqual(['Một', 'Hai']);
  });
});
