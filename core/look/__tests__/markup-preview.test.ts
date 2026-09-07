import { describe, expect, it } from 'vitest';
import { buildLookPreview, captionStyleOf } from '../markup';
import { DEFAULT_STAGE } from '@/nodes/art-director/node';
import { DEFAULT_BLOCK } from '@/nodes/art-director/blocks';

describe('buildLookPreview with a sample caption', () => {
  it('puts the line in the stage slot as one span per word, and lights the words up only when animating', () => {
    const html = buildLookPreview({ stage: DEFAULT_STAGE, block: DEFAULT_BLOCK, animate: { gsapSource: '/*g*/', loopSeconds: 3 }, captions: 'one two three' });
    expect(html.split('class="nc-cap-w"').length - 1).toBe(3);
    expect(html).toContain('data-slot="captions"');
    expect(html).not.toContain('nc-captions-default'); // the default stage has its own slot
    expect(html).toContain('"captions":{"style":"karaoke"}');
    expect(html).toContain("'unsafe-eval'");
    const still = buildLookPreview({ stage: DEFAULT_STAGE, block: DEFAULT_BLOCK });
    expect(still).not.toContain('nc-cap-w');
    expect(still).not.toContain("'unsafe-eval'");
  });

  it('hands an image prop to the page and binds it as a source, not as text', () => {
    const shot = '/api/assets/0123456789abcdef0123456789abcdef01234567.png';
    const block = { ...DEFAULT_BLOCK, props: { ...DEFAULT_BLOCK.props, shot: { type: 'image' as const, content: 'image' as const, required: false } }, code: { ...DEFAULT_BLOCK.code, source: `${DEFAULT_BLOCK.code.source}<img data-prop="shot" data-if="shot" alt="">` } };
    const html = buildLookPreview({ stage: DEFAULT_STAGE, block, props: { headline: 'H', shot } });
    expect(html).toContain(shot);
    expect(html).toContain("el.tagName === 'IMG'");
  });

  it('adds the default band when the stage has no caption slot, and reads the slot style', () => {
    const bare = { ...DEFAULT_STAGE, code: { ...DEFAULT_STAGE.code, source: DEFAULT_STAGE.code.source.replace(/<div class="captions"[^>]*><\/div>/, '') } };
    const html = buildLookPreview({ stage: bare, captions: 'a b' });
    expect(html).toContain('nc-captions-default');
    expect(captionStyleOf('<div data-slot="captions" data-caption-style="reveal">')).toBe('reveal');
    expect(captionStyleOf('<div data-slot="captions">')).toBe('karaoke');
  });
});
