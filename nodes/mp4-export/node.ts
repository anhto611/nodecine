import { z } from 'zod';
import { ErrorCode } from '@/core/errors';
import { safeFileName } from '@/core/file-name';
import { missingCodeRenderers } from '@/core/visual/renderers';
import { SCENE_FORMAT, type EngineRef } from '@/core/types/payloads';
import type { VideoIR } from '@/core/types/ir';
import type { NodeDefinition } from '@/core/nodes/definition';

const Params = z.object({ codec: z.enum(['h264', 'h265']).default('h264'), quality: z.enum(['high', 'medium', 'low']).default('high'), fileName: z.string().min(1).default('nodecine.mp4'), resolution: z.enum(['1080p', '1440p', '2160p']).default('1080p') });
export const mp4Export: NodeDefinition<typeof Params> = {
  type: 'core/mp4-export', version: 1, kind: 'ondemand', defaultBypassed: true,
  inputs: [{ name: 'ir', type: 'VideoIR' }, { name: 'engine', type: 'EngineRef', requires: ['render'] }], outputs: [],
  paramsSchema: Params, defaultParams: { codec: 'h264', quality: 'high', fileName: 'nodecine.mp4', resolution: '1080p' },
  preflight: (inputs) => {
    const engine = inputs.engine?.payload as EngineRef | undefined;
    if (!inputs.ir || !engine) return null;
    const missing = missingCodeRenderers([SCENE_FORMAT], engine.engineId);
    return missing.length ? { kind: 'capability', code: ErrorCode.ENGINE_SCENE_UNSUPPORTED, message: `${engine.displayName} has no renderer for: ${missing.join(', ')}` } : null;
  },
  run: async ({ params, inputs, services, signal, log, progress }) => {
    const ir = inputs.ir!.payload as VideoIR;
    const engine = inputs.engine!.payload as EngineRef;
    const fileName = safeFileName(params.fileName, 'nodecine.mp4');
    const result = await services.render(engine, ir, { ...params, fileName }, (p) => progress(p.totalFrames ? p.renderedFrames / p.totalFrames : 0, `${p.renderedFrames}/${p.totalFrames}`), signal);
    log('info', `done · ${result.bytes} bytes · ${result.outputUrl}`);
    return { ...result, fileName };
  },
};
