import { z } from 'zod';
import { ErrorCode } from '@/core/errors';
import type { NodeDefinition } from '@/core/nodes/definition';
import { AssetUrlSchema, SCENE_SOURCE_MAX, type LayerSpec } from '@/core/types/payloads';

const Params = z.object({
  kind: z.enum(['media', 'code']).default('media'),
  /** A clip taken from the clips folder or a picture uploaded; the asset it became (CORE_CONTRACTS §2.7). */
  url: z.union([AssetUrlSchema, z.literal('')]).default(''),
  /** The drawing, when the layer is code: an HTML fragment like a scene's. */
  source: z.string().max(SCENE_SOURCE_MAX).default(''),
  placement: z.enum(['under', 'over']).default('under'),
  fit: z.enum(['cover', 'contain']).default('cover'),
  loop: z.boolean().default(true),
  offsetSeconds: z.number().nonnegative().default(0),
  gain: z.number().min(0).max(1).default(0),
  startSeconds: z.number().nonnegative().default(0),
  /** How long the layer stays; the rest of the film when unset. */
  durationSeconds: z.number().positive().optional(),
});
export type LayerParams = z.infer<typeof Params>;

export const LAYER = 'core/layer';

/**
 * CORE_CONTRACTS §5.20 — a layer of the film, beside the scenes. Nothing is decided here: the node
 * turns its parameters into one `LayerSpec`, and the Timeline Assembler makes a track of it, under
 * or over the scenes, clamped to the film. A file gives gameplay under a story, a recording the
 * scenes annotate, a logo in a corner; a drawing gives a phone or a caption bar that spans the film
 * and reads `nodecine.beats` to move with the cut (docs/IR_V3.md §5.2).
 */
export const layer: NodeDefinition<typeof Params> = {
  type: LAYER,
  version: 1,
  kind: 'source',
  inputs: [],
  outputs: [{ name: 'layer', type: 'LayerSpec' }],
  paramsSchema: Params,
  defaultParams: { kind: 'media', url: '', source: '', placement: 'under', fit: 'cover', loop: true, offsetSeconds: 0, gain: 0, startSeconds: 0 },
  validate: (p) => {
    if (p.kind === 'media' && !p.url) return [{ code: ErrorCode.INPUT_EMPTY, message: 'choose a clip or a picture' }];
    if (p.kind === 'code' && !p.source.trim()) return [{ code: ErrorCode.INPUT_EMPTY, message: 'write the drawing' }];
    return [];
  },
  run: async ({ params: p, log }) => {
    const span = { placement: p.placement, startSeconds: p.startSeconds, ...(p.durationSeconds ? { durationSeconds: p.durationSeconds } : {}) };
    const spec: LayerSpec = p.kind === 'media'
      ? { kind: 'media', url: p.url, ...span, offsetSeconds: p.offsetSeconds, fit: p.fit, loop: p.loop, gain: p.gain }
      : { kind: 'code', source: p.source, ...span };
    log('info', `${p.kind} ${p.placement} the scenes · from ${p.startSeconds}s${p.durationSeconds ? ` for ${p.durationSeconds}s` : ' to the end'}`);
    return { layer: spec };
  },
};
