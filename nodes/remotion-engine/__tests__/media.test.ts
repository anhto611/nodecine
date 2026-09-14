import { describe, expect, it } from 'vitest';
import { loopFramesFor } from '../Video';
import type { Clip } from '@/contracts/types/ir';

const clip = (over: Partial<Extract<Clip, { kind: 'media' }>> = {}): Extract<Clip, { kind: 'media' }> => ({
  id: 'bg', kind: 'media', startFrame: 0, durationInFrames: 300, url: '/api/assets/' + 'a'.repeat(16) + '.mp4',
  offsetSeconds: 0, fit: 'cover', loop: true, gain: 0, sourceSeconds: 6.5, ...over,
});

describe('repeating a media clip under a longer film', () => {
  it('is one pass of the file, in frames, counted from where the clip starts reading it', () => {
    expect(loopFramesFor(clip(), 30)).toBe(195);
    expect(loopFramesFor(clip({ offsetSeconds: 2 }), 30)).toBe(135);
  });

  it('plays once when it is not asked to repeat, when nobody measured the file, or when the file already covers the clip', () => {
    expect(loopFramesFor(clip({ loop: false }), 30)).toBe(0);
    expect(loopFramesFor(clip({ sourceSeconds: undefined }), 30)).toBe(0);
    expect(loopFramesFor(clip({ sourceSeconds: 20 }), 30)).toBe(0);
  });
});
