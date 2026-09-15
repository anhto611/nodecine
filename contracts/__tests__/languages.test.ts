import { describe, expect, it } from 'vitest';
import { OUTPUT_LANGUAGES, languageName, resolveOutputLanguage, sameLanguage } from '../text/languages';

describe('resolveOutputLanguage', () => {
  it('auto follows the source text', () => {
    expect(resolveOutputLanguage('auto', 'Tiny widgets for the web. Install it and go.')).toBe('en');
    expect(resolveOutputLanguage('auto', 'Bộ tiện ích nhỏ cho web. Cài đặt rồi dùng.')).toBe('vi');
  });

  it('an explicit choice wins over the source, whatever its casing', () => {
    expect(resolveOutputLanguage('vi', 'Tiny widgets for the web.')).toBe('vi');
    expect(resolveOutputLanguage('VI', 'Tiny widgets for the web.')).toBe('vi');
  });

  it('reads the words, not the web addresses among them', () => {
    expect(resolveOutputLanguage('auto', 'https://www.example.com/some/english/words/here/and/more 가계부 앱 소개 영상')).toBe('ko');
  });

  it('falls back rather than throwing when there is no source to read', () => {
    expect(resolveOutputLanguage('auto', '')).toBe('en');
  });
});

describe('sameLanguage', () => {
  it('compares primary subtags only', () => {
    expect(sameLanguage('en-US', 'en')).toBe(true);
    expect(sameLanguage('EN', 'en-GB')).toBe(true);
    expect(sameLanguage('vi', 'en')).toBe(false);
  });
});

describe('the picker list', () => {
  it('starts with auto and names every language it offers', () => {
    expect(OUTPUT_LANGUAGES[0]).toBe('auto');
    for (const code of OUTPUT_LANGUAGES.slice(1)) expect(languageName(code)).not.toBe(code);
  });
  it('gives back the code for a language it cannot name', () => {
    expect(languageName('xx')).toBe('xx');
  });
});
