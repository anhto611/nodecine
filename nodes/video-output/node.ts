import { z } from 'zod';
import { ErrorCode } from '@/core/errors';
import { missingCodeRenderers } from '@/core/visual/renderers';
import { SCENE_FORMAT, type EngineRef } from '@/core/types/payloads';
import type { VideoIR } from '@/core/types/ir';
import type { NodeDefinition } from '@/core/nodes/definition';

const Params = z.object({});
export const videoOutput: NodeDefinition<typeof Params> = {
  type: 'core/video-output', version: 1, kind: 'sink',
  inputs: [{ name: 'ir', type: 'VideoIR' }, { name: 'engine', type: 'EngineRef', requires: ['preview'] }],
  outputs: [], paramsSchema: Params, defaultParams: {},
  preflight: (inputs) => {
    const engine = inputs.engine?.payload as EngineRef | undefined;
    if (!inputs.ir || !engine) return null;
    const missing = missingCodeRenderers([SCENE_FORMAT], engine.engineId);
    return missing.length ? { kind: 'capability', code: ErrorCode.ENGINE_SCENE_UNSUPPORTED, message: `${engine.displayName} has no renderer for: ${missing.join(', ')}` } : null;
  },
  run: async ({ inputs, log }) => {
    const ir = inputs.ir!.payload as VideoIR;
    const engine = inputs.engine!.payload as EngineRef;
    log('info', `irVersion=${ir.irVersion} · engine=${engine.engineId} · ${ir.meta.totalDurationInFrames} frames`);
    return { engineId: engine.engineId, totalFrames: ir.meta.totalDurationInFrames };
  },
};
