import { z } from 'zod';
import { resolveEngine } from '@/contracts/resources';
import { unsupportedFilmBlock } from '@/contracts/visual/transitions';
import type { VideoIR } from '@/contracts/types/ir';
import type { NodeDefinition } from '@/core/nodes/definition';

const Params = z.object({
  /** The engine this node draws with: an engine id and its settings. */
  engineId: z.string().max(60).default(''),
  engineSettings: z.record(z.string(), z.unknown()).default({}),
});
export const videoOutput: NodeDefinition<typeof Params> = {
  type: 'video-output', version: 1, kind: 'sink',
  inputs: [{ name: 'ir', type: 'VideoIR' }],
  outputs: [], paramsSchema: Params, defaultParams: { engineId: '', engineSettings: {} },
  preflight: (inputs, params) => unsupportedFilmBlock(params.engineId, inputs.ir?.payload as VideoIR | undefined),
  run: async ({ params, inputs, services, log }) => {
    const ir = inputs.ir!.payload as VideoIR;
    const engine = await resolveEngine(services, params, ['preview']);
    log('info', `irVersion=${ir.irVersion} · engine=${engine.engineId} · ${ir.meta.totalDurationInFrames} frames`);
    // The whole ref, not its id: the card decides whether to mount the player by reading this
    // engine's `preview` capability off it. Returning a summary instead left every finished run
    // showing "preview is not available on this engine" while the engine said it was ready.
    return { ...engine, totalFrames: ir.meta.totalDurationInFrames };
  },
};
