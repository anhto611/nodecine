import { describe, expect, it } from 'vitest';
import { AssetUrlSchema, INLINE_ASSET_MAX_CHARS, isInlineAsset } from '@/core/types/payloads';

const svg = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');

describe('AssetUrlSchema', () => {
  it('takes a hashed upload and a small inline SVG, nothing else', () => {
    expect(AssetUrlSchema.safeParse('/api/assets/0123456789abcdef.png').success).toBe(true);
    expect(AssetUrlSchema.safeParse(svg).success).toBe(true);
    // A link is not a file this machine holds; a PNG travels hashed, not inline.
    expect(AssetUrlSchema.safeParse('https://example.com/a.svg').success).toBe(false);
    expect(AssetUrlSchema.safeParse('data:image/png;base64,iVBORw0KGgo=').success).toBe(false);
    expect(AssetUrlSchema.safeParse('data:image/svg+xml;utf8,<svg/>').success).toBe(false);
    expect(AssetUrlSchema.safeParse('/templates/compare/website.svg').success).toBe(false);
  });

  it('caps an inline drawing so a graph stays a graph', () => {
    const big = 'data:image/svg+xml;base64,' + 'A'.repeat(INLINE_ASSET_MAX_CHARS);
    expect(isInlineAsset(big)).toBe(false);
    expect(AssetUrlSchema.safeParse(big).success).toBe(false);
    expect(isInlineAsset(svg)).toBe(true);
  });
});
