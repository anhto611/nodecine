import { z } from 'zod';
import { ErrorCode } from '../errors';
import { missingRenderers } from '../scenes/registry';
import type { EngineRef } from '../types/payloads';
import type { VideoIR } from '../types/ir';
import type { Packet } from '../types/packet';
import type { BlockReason, NodeDefinition } from './definition';

/** Both output nodes block by capability when the engine lacks a renderer for a scene (CORE_CONTRACTS §4). */
function sceneSupportPreflight(inputs: Record<string, Packet>): BlockReason | null {
  const ir = inputs.ir?.payload as VideoIR | undefined;
  const engine = inputs.engine?.payload as EngineRef | undefined;
  if (!ir || !engine) return null;
  const missing = missingRenderers(ir.timeline.map((s) => s.sceneType), engine.engineId);
  if (missing.length === 0) return null;
  return {
    kind: 'capability',
    code: ErrorCode.ENGINE_SCENE_UNSUPPORTED,
    message: `${engine.displayName} has no renderer for: ${missing.join(', ')}`,
  };
}

const OutputParams = z.object({});

/** CORE_CONTRACTS §5.5 — the player. No outputs; the UI mounts the player from this node's inputs. */
export const videoOutput: NodeDefinition<typeof OutputParams> = {
  type: 'core/video-output',
  version: 1,
  pack: 'core',
  kind: 'sink',
  inputs: [
    { name: 'ir', type: 'VideoIR' },
    { name: 'engine', type: 'EngineRef', requires: ['preview'] },
  ],
  outputs: [],
  paramsSchema: OutputParams,
  defaultParams: {},
  preflight: sceneSupportPreflight,
  run: async ({ inputs, log }) => {
    const ir = inputs.ir!.payload as VideoIR;
    const engine = inputs.engine!.payload as EngineRef;
    log('info', `irVersion=${ir.irVersion} · engine=${engine.engineId} · ${ir.meta.totalDurationInFrames} frames`);
    return { engineId: engine.engineId, totalFrames: ir.meta.totalDurationInFrames };
  },
};

const ExportParams = z.object({
  codec: z.enum(['h264', 'h265']).default('h264'),
  quality: z.enum(['high', 'medium', 'low']).default('high'),
  fileName: z.string().min(1).default('nodecine.mp4'),
});

/** CORE_CONTRACTS §5.6 — bypassed by default; runs when the user presses Render. */
export const mp4Export: NodeDefinition<typeof ExportParams> = {
  type: 'core/mp4-export',
  version: 1,
  pack: 'core',
  kind: 'ondemand',
  inputs: [
    { name: 'ir', type: 'VideoIR' },
    { name: 'engine', type: 'EngineRef', requires: ['render'] },
  ],
  outputs: [],
  paramsSchema: ExportParams,
  defaultParams: { codec: 'h264', quality: 'high', fileName: 'nodecine.mp4' },
  defaultBypassed: true,
  preflight: sceneSupportPreflight,
  run: async ({ params, inputs, services, signal, log, progress }) => {
    const ir = inputs.ir!.payload as VideoIR;
    const engine = inputs.engine!.payload as EngineRef;
    const fileName = params.fileName.replace(/[^\w.-]+/g, '-');
    log('info', `start · ${params.codec} · ${params.quality} · ${fileName}`);
    const result = await services.render(
      engine,
      ir,
      { ...params, fileName },
      (p) => progress(p.totalFrames ? p.renderedFrames / p.totalFrames : 0, `${p.renderedFrames}/${p.totalFrames}`),
      signal,
    );
    log('info', `done · ${result.bytes} bytes · ${result.outputUrl}`);
    return { ...result, fileName };
  },
};
