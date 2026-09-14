import { describe, expect, it } from 'vitest';
import { layer } from '../node';
import { LayerSpecSchema } from '@/contracts/types/payloads';
import { makeFakeServices } from '@/contracts/__tests__/fakes';

const CLIP = '/api/assets/' + 'a'.repeat(16) + '.mp4';
const run = async (params: Record<string, unknown>) => {
  const p = layer.paramsSchema.parse({ ...layer.defaultParams, ...params });
  const out = await layer.run({ nodeId: 'l', params: p, inputs: {}, lists: {}, signal: new AbortController().signal, services: makeFakeServices(), log: () => {}, progress: () => {}, patchParams: () => {} });
  // A sheet of one: the node emits what the Set emits, so the assembler has one port for both.
  return (out.layers as { layers: unknown[] }).layers[0];
};

describe('the Layer node', () => {
  it('needs a file for a file and a drawing for a drawing', () => {
    expect(layer.validate!(layer.paramsSchema.parse(layer.defaultParams))).toHaveLength(1);
    expect(layer.validate!(layer.paramsSchema.parse({ ...layer.defaultParams, url: CLIP }))).toEqual([]);
    expect(layer.validate!(layer.paramsSchema.parse({ ...layer.defaultParams, kind: 'code' }))).toHaveLength(1);
    expect(layer.validate!(layer.paramsSchema.parse({ ...layer.defaultParams, kind: 'code', source: '<div class="phone"></div>' }))).toEqual([]);
  });

  it('emits a media layer that spans the film by default, and says only what applies', async () => {
    const spec = await run({ url: CLIP });
    expect(spec).toEqual({ kind: 'media', url: CLIP, placement: 'under', startSeconds: 0, offsetSeconds: 0, fit: 'cover', loop: true, gain: 0, sourceSeconds: 6.5 });
    expect(LayerSpecSchema.safeParse(spec).success).toBe(true);
  });

  it('emits a code layer with its span, without the file fields', async () => {
    const spec = await run({ kind: 'code', source: '<div class="bar"></div>', placement: 'over', startSeconds: 2, durationSeconds: 5, loop: false, gain: 1 });
    expect(spec).toEqual({ kind: 'code', source: '<div class="bar"></div>', placement: 'over', startSeconds: 2, durationSeconds: 5 });
    expect(LayerSpecSchema.safeParse(spec).success).toBe(true);
  });

  it('refuses a file that is not an asset this machine holds', () => {
    expect(layer.paramsSchema.safeParse({ ...layer.defaultParams, url: 'https://example.com/a.mp4' }).success).toBe(false);
    expect(layer.paramsSchema.safeParse({ ...layer.defaultParams, url: '/Users/me/a.mp4' }).success).toBe(false);
  });
});

describe('a layer in another format', () => {
  it('names the format only when it is not the default', async () => {
    expect(await run({ kind: 'code', source: '<canvas></canvas>' })).not.toHaveProperty('format');
    expect(await run({ kind: 'code', source: '{"v":"5"}', format: 'lottie' })).toMatchObject({ kind: 'code', format: 'lottie', loop: true });
    expect(await run({ kind: 'code', source: '{"v":"5"}', format: 'lottie', loop: false })).toMatchObject({ loop: false });
    // A plain gsap drawing has no length of its own, so it carries no loop at all.
    expect(await run({ kind: 'code', source: '<div></div>' })).not.toHaveProperty('loop');
    expect(layer.paramsSchema.safeParse({ ...layer.defaultParams, format: 'flash' }).success).toBe(false);
  });
});

describe('the file behind a media layer', () => {
  it('is measured, so an engine can repeat it; a picture measures as nothing', async () => {
    expect(await run({ url: CLIP })).toMatchObject({ sourceSeconds: 6.5 });
    expect(await run({ url: '/api/assets/' + 'b'.repeat(16) + '.png' })).not.toHaveProperty('sourceSeconds');
    expect(await run({ kind: 'code', source: '<div></div>' })).not.toHaveProperty('sourceSeconds');
  });
});
