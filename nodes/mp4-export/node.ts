import { z } from 'zod';
import { ErrorCode } from '@/core/errors';
import { Mp4ExportErrorCode } from './errors';
import { safeFileName } from '@/core/file-name';
import { unsupportedSceneBlock } from '@/core/visual/renderers';
import type { EngineRef } from '@/core/types/payloads';
import type { VideoIR } from '@/core/types/ir';
import type { NodeDefinition } from '@/core/nodes/definition';
import { NodeError } from '@/core/errors';

const Params = z.object({ codec: z.enum(['h264', 'h265']).default('h264'), quality: z.enum(['high', 'medium', 'low']).default('high'), fileName: z.string().min(1).default('nodecine.mp4'), resolution: z.enum(['1080p', '1440p', '2160p']).default('1080p') });
export const mp4Export: NodeDefinition<typeof Params> = {
  type: 'core/mp4-export', version: 1, kind: 'ondemand', defaultBypassed: true,
  inputs: [{ name: 'ir', type: 'VideoIR' }, { name: 'engine', type: 'EngineRef', requires: ['render'] }], outputs: [],
  paramsSchema: Params, defaultParams: { codec: 'h264', quality: 'high', fileName: 'nodecine.mp4', resolution: '1080p' },
  preflight: (inputs) => unsupportedSceneBlock(inputs.engine?.payload as EngineRef | undefined, !!inputs.ir),
  run: async ({ params, inputs, services, signal, log, progress }) => {
    const ir = inputs.ir!.payload as VideoIR;
    const engine = inputs.engine!.payload as EngineRef;
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
