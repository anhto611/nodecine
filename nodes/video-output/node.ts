import { z } from 'zod';
import { unsupportedFilmBlock } from '@/core/visual/transitions';
import type { EngineRef } from '@/core/types/payloads';
import type { VideoIR } from '@/core/types/ir';
import type { NodeDefinition } from '@/core/nodes/definition';

const Params = z.object({});
export const videoOutput: NodeDefinition<typeof Params> = {
  type: 'core/video-output', version: 1, kind: 'sink',
  inputs: [{ name: 'ir', type: 'VideoIR' }, { name: 'engine', type: 'EngineRef', requires: ['preview'] }],
  outputs: [], paramsSchema: Params, defaultParams: {},
  preflight: (inputs) => unsupportedFilmBlock(inputs.engine?.payload as EngineRef | undefined, inputs.ir?.payload as VideoIR | undefined),
  run: async ({ inputs, log }) => {
    const ir = inputs.ir!.payload as VideoIR;
    const engine = inputs.engine!.payload as EngineRef;
    log('info', `irVersion=${ir.irVersion} · engine=${engine.engineId} · ${ir.meta.totalDurationInFrames} frames`);
    return { engineId: engine.engineId, totalFrames: ir.meta.totalDurationInFrames };
  },
};
