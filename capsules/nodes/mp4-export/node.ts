import { z } from 'zod';
import { resolveEngine } from '@/contracts/resources';
import { ErrorCode } from '@/contracts/errors';
import { Mp4ExportErrorCode } from './errors';
import { safeFileName } from '@/contracts/file-name';
import { unsupportedFilmBlock } from '@/contracts/visual/transitions';
import type { VideoIR } from '@/contracts/types/ir';
import type { NodeDefinition } from '@/core/nodes/definition';
import { NodeError } from '@/contracts/errors';

const Params = z.object({
  /** The engine this node draws with: an engine id and its settings. */
  engineId: z.string().max(60).default(''),
  engineSettings: z.record(z.string(), z.unknown()).default({}),
  codec: z.enum(['h264', 'h265']).default('h264'), quality: z.enum(['high', 'medium', 'low']).default('high'), fileName: z.string().min(1).default('nodecine.mp4'), resolution: z.enum(['1080p', '1440p', '2160p']).default('1080p') });
export const mp4Export: NodeDefinition<typeof Params> = {
  type: 'mp4-export', version: 1, kind: 'ondemand',
  inputs: [{ name: 'ir', type: 'VideoIR' }], outputs: [],
  paramsSchema: Params, defaultParams: { engineId: '', engineSettings: {}, codec: 'h264', quality: 'high', fileName: 'nodecine.mp4', resolution: '1080p' },
  preflight: (inputs, params) => unsupportedFilmBlock(params.engineId, inputs.ir?.payload as VideoIR | undefined),
  run: async ({ params, inputs, services, signal, log, progress }) => {
    const ir = inputs.ir!.payload as VideoIR;
    const engine = await resolveEngine(services, params, ['render']);
    const fileName = safeFileName(params.fileName, 'nodecine.mp4');
    // A render is minutes of somebody's evening: when it fails, the log should say a render failed,
    // not repeat whichever subprocess message came back up the stack under a generic code.
    let result;
    try {
      result = await services.render(engine, ir, { ...params, fileName }, (p) => progress(p.totalFrames ? p.renderedFrames / p.totalFrames : 0, `${p.renderedFrames}/${p.totalFrames}`), signal);
    } catch (e) {
      const cause = e instanceof Error ? e.message : String(e);
      if (signal.aborted || (e as { code?: string }).code === ErrorCode.RUN_CANCELLED) {
        throw new NodeError(Mp4ExportErrorCode.EXPORT_CANCELLED, `render cancelled: ${cause}`);
      }
      throw new NodeError(Mp4ExportErrorCode.EXPORT_FAILED, `${engine.displayName} could not render this film: ${cause}`, true).withFix('try the render again, or pick a lower resolution');
    }
    log('info', `done · ${result.bytes} bytes · ${result.outputUrl}`);
    return { ...result, fileName };
  },
};
