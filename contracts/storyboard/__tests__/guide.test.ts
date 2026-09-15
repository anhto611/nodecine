import { describe, expect, it } from 'vitest';
import { labelOf } from '../blocks';
import { readGuide } from '../guide';

describe('a storyboard guide', () => {
  it('keeps what the node enforces apart from what the model reads', () => {
    const guide = readGuide('---\nfirst: hook\nlast: finale\nrepeat: 2\n---\n# How films are built\n');
    expect(guide).toEqual({ first: 'hook', last: undefined, repeat: 2, body: '# How films are built\n' });
  });

  it('without a header is all body, and asks nothing of the scenes', () => {
    expect(readGuide('Anything goes.')).toEqual({ first: undefined, last: undefined, repeat: undefined, body: 'Anything goes.' });
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
