import { describe, expect, it } from 'vitest';
import { AssetUrlSchema, INLINE_ASSET_MAX_CHARS, isInlineAsset } from '@/contracts/types/payloads';

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

describe('a var of the video', () => {
  it('is text, or a picture', async () => {
    const { VarsSchema, isAssetUrl } = await import('@/contracts/types/payloads');
    const ok = (vars: Record<string, string>) => VarsSchema.safeParse(vars).success;
    expect(ok({ channel: '@kenh', character: '/api/assets/0123456789abcdef.png' })).toBe(true);
    expect(ok({ character: svg })).toBe(true);
    expect(ok({ character: 'x'.repeat(201) })).toBe(false);
    // A link is short text as far as the schema goes; it is simply not drawn as a picture.
    expect(ok({ character: 'https://example.com/a.png' })).toBe(true);
    expect(isAssetUrl('https://example.com/a.png')).toBe(false);
  });
});
