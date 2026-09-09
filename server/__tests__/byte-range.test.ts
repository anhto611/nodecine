import { describe, expect, it } from 'vitest';
import { byteRange } from '@/server/byte-range';

/**
 * The header a video element sends, read the way RFC 9110 defines it. Getting this wrong raises no
 * error: the browser simply downloads whole clips and the preview stalls.
 */
describe('byteRange', () => {
  it('reads an open range as the rest of the file', () => {
    expect(byteRange('bytes=0-', 1000)).toEqual({ start: 0, end: 999 });
    expect(byteRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 });
  });

  it('reads a closed range, and clamps an end past the file', () => {
    expect(byteRange('bytes=10-19', 1000)).toEqual({ start: 10, end: 19 });
    expect(byteRange('bytes=990-2000', 1000)).toEqual({ start: 990, end: 999 });
  });

  it('reads a suffix range as the last bytes, which is how a player reads an MP4 index', () => {
    expect(byteRange('bytes=-500', 1000)).toEqual({ start: 500, end: 999 });
    expect(byteRange('bytes=-5000', 1000)).toEqual({ start: 0, end: 999 });
  });

  it('says nothing without a range, and refuses one that starts past the end', () => {
    expect(byteRange(null, 1000)).toBeNull();
    expect(byteRange('bytes=abc', 1000)).toBeNull();
    expect(byteRange('bytes=-', 1000)).toBeNull();
    expect(byteRange('bytes=1000-', 1000)).toBe('unsatisfiable');
    expect(byteRange('bytes=900-800', 1000)).toBe('unsatisfiable');
  });
});
