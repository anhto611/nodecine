import { describe, it, expect } from 'vitest';
import { contentHash, stableStringify } from '../hash';

describe('contentHash', () => {
  it('is independent of key order', () => {
    expect(contentHash({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(contentHash({ b: [1, { d: 3, c: 2 }], a: 1 }));
  });
  it('differs for different content', () => {
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
  });
  it('drops undefined values', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});
