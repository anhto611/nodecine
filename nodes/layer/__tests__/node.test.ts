import { describe, expect, it } from 'vitest';
import { layer } from '../node';
import { LayerSpecSchema } from '@/core/types/payloads';
import { makeFakeServices } from '@/core/__tests__/fakes';

const CLIP = '/api/assets/' + 'a'.repeat(16) + '.mp4';
const run = async (params: Record<string, unknown>) => {
  const p = layer.paramsSchema.parse({ ...layer.defaultParams, ...params });
  const out = await layer.run({ nodeId: 'l', params: p, inputs: {}, lists: {}, signal: new AbortController().signal, services: makeFakeServices(), log: () => {}, progress: () => {}, patchParams: () => {} });
  return out.layer;
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
    expect(spec).toEqual({ kind: 'media', url: CLIP, placement: 'under', startSeconds: 0, offsetSeconds: 0, fit: 'cover', loop: true, gain: 0 });
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
