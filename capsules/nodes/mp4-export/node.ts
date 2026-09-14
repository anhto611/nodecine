import { z } from 'zod';
import { resolveEngine } from '@/contracts/resources';
import { ErrorCode, NodeError } from '@/contracts/errors';
import { Mp4ExportErrorCode } from './errors';
import { safeFileName } from '@/contracts/file-name';
import type { Composition } from '@/contracts/types/composition';
import type { NodeDefinition } from '@/core/nodes/definition';

const Params = z.object({
  quality: z.enum(['high', 'medium', 'low']).default('high'),
  fileName: z.string().min(1).default('nodecine.mp4'),
});

/** The composition rendered to a file by the engine it names, when its button is pressed. */
export const mp4Export: NodeDefinition<typeof Params> = {
  type: 'mp4-export', version: 2, kind: 'ondemand',
  inputs: [{ name: 'composition', type: 'Composition' }], outputs: [],
  paramsSchema: Params, defaultParams: { quality: 'high', fileName: 'nodecine.mp4' },
  // Version 1 chose its engine, codec and resolution on the node; the composition decides those now.
  migrate: (params) => ({
    ...(params.quality !== undefined ? { quality: params.quality } : {}),
    ...(params.fileName !== undefined ? { fileName: params.fileName } : {}),
  }),
  run: async ({ params, inputs, services, signal, log, progress }) => {
    const composition = inputs.composition!.payload as Composition;
    const engine = await resolveEngine(services, composition.engine, ['render']);
    const fileName = safeFileName(params.fileName, 'nodecine.mp4');
    // A render is minutes of somebody's evening: when it fails, the log should say a render failed,
    // not repeat whichever subprocess message came back up the stack under a generic code.
    let result;
    try {
      result = await services.render(engine, composition, { quality: params.quality, fileName }, (p) => progress(p.fraction, p.message), signal);
    } catch (e) {
      const cause = e instanceof Error ? e.message : String(e);
      if (signal.aborted || (e as { code?: string }).code === ErrorCode.RUN_CANCELLED) {
        throw new NodeError(Mp4ExportErrorCode.EXPORT_CANCELLED, `render cancelled: ${cause}`);
      }
      throw new NodeError(Mp4ExportErrorCode.EXPORT_FAILED, `${engine.displayName} could not render this composition: ${cause}`, true).withFix('try the render again, or a lower quality');
    }
    log('info', `done · ${result.bytes} bytes · ${result.outputUrl}`);
    return { ...result, fileName };
  },
};
