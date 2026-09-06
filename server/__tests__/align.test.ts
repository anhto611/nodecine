import { describe, expect, it } from 'vitest';
import { parseAlignerOutput } from '../align';

describe('parseAlignerOutput', () => {
  it('keeps well-formed words, clamps negatives and inverted spans, drops junk', () => {
    const out = parseAlignerOutput(JSON.stringify([{ text: 'Xin', start: -0.1, end: 0.2 }, { text: 'chào', start: 0.6, end: 0.5 }, { nope: true }, 'x']));
    expect(out).toEqual([{ text: 'Xin', start: 0, end: 0.2 }, { text: 'chào', start: 0.6, end: 0.6 }]);
  });
  it('refuses anything that is not a list', () => {
    expect(() => parseAlignerOutput('{"a":1}')).toThrow(/list/);
  });
});
