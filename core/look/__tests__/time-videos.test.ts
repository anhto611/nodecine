import { describe, expect, it } from 'vitest';
import { timeVideos } from '../markup';

describe('timeVideos', () => {
  it('gives a clip the scene it sits in, and silences it', () => {
    expect(timeVideos('<video data-prop="clip"></video>', 4.5, 3)).toBe('<video data-prop="clip" data-start="4.5" data-duration="3" muted playsinline></video>');
  });

  it('leaves timing the block author wrote alone', () => {
    expect(timeVideos('<video data-prop="clip" data-start="0" data-end="2"></video>', 4.5, 3)).toBe('<video data-prop="clip" data-start="0" data-end="2" muted playsinline></video>');
  });

  it('does not stack attributes it already sees', () => {
    const once = timeVideos('<video muted playsinline data-prop="c"></video>', 1, 2);
    expect(timeVideos(once, 1, 2)).toBe(once);
    expect((once.match(/muted/g) ?? []).length).toBe(1);
  });

  it('times every clip in the scene, and touches nothing else', () => {
    const out = timeVideos('<div><img src="a.png"><video id="a"></video><p>video</p><VIDEO id="b"></VIDEO></div>', 2, 1);
    expect(out).toContain('<video id="a" data-start="2" data-duration="1" muted playsinline>');
    expect(out).toContain('<VIDEO id="b" data-start="2" data-duration="1" muted playsinline>');
    expect(out).toContain('<img src="a.png">');
    expect(out).toContain('<p>video</p>');
  });
});
