import { describe, expect, it } from 'vitest';
import { labelOf } from '../blocks';
import { guideHint, readGuide } from '../guide';

describe('a storyboard guide', () => {
  it('keeps what the node shows and enforces apart from what the model reads', () => {
    const guide = readGuide('---\nhint.vi: Dán link app\nhint.en: Paste the app link\nfirst: hook\nlast: finale\nrepeat: 2\n---\n# How films are built\n');
    expect(guide).toEqual({ hint: { vi: 'Dán link app', en: 'Paste the app link' }, first: 'hook', last: undefined, repeat: 2, body: '# How films are built\n' });
    expect(guideHint(guide, 'vi-VN')).toBe('Dán link app');
    expect(guideHint(guide, 'fr')).toBeUndefined();
  });

  it('without a header is all body, and asks nothing of the scenes', () => {
    expect(readGuide('Anything goes.')).toEqual({ hint: {}, first: undefined, last: undefined, repeat: undefined, body: 'Anything goes.' });
    expect(readGuide(undefined).body).toBe('');
  });
});

describe('a block variable label', () => {
  it('is read in the locale when the block gives one', () => {
    const v = { id: 'name', type: 'string' as const, label: 'Name', default: '', labels: { vi: 'Tên' } };
    expect(labelOf(v, 'vi')).toBe('Tên');
    expect(labelOf(v, 'en')).toBe('Name');
  });
});
