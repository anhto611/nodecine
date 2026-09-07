import { z } from 'zod';
import { safeFileName } from '@/core/file-name';
import { ErrorCode } from '@/core/errors';
import { missingCodeRenderers } from '@/core/look/renderers';
import type { EngineRef } from '@/core/types/payloads';
import type { VideoIR } from '@/core/types/ir';
import type { Packet } from '@/core/types/packet';
import type { BlockReason, NodeDefinition } from '@/core/nodes/definition';

/** Both output nodes block by capability when the engine cannot draw the IR's scene-code format (CORE_CONTRACTS §2.8). */
function sceneSupportPreflight(inputs: Record<string, Packet>): BlockReason | null {
  const ir = inputs.ir?.payload as VideoIR | undefined;
  const engine = inputs.engine?.payload as EngineRef | undefined;
  if (!ir || !engine) return null;
  const missing = missingCodeRenderers([ir.stage.code.format, ...ir.blocks.map((b) => b.code.format)], engine.engineId);
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
  resolution: z.enum(['1080p', '1440p', '2160p']).default('1080p'),
});

/** CORE_CONTRACTS §5.6 — bypassed by default; runs when the user presses Render. */
export const mp4Export: NodeDefinition<typeof ExportParams> = {
  type: 'core/mp4-export',
  version: 1,
  kind: 'ondemand',
  inputs: [
    { name: 'ir', type: 'VideoIR' },
    { name: 'engine', type: 'EngineRef', requires: ['render'] },
  ],
  outputs: [],
  paramsSchema: ExportParams,
  defaultParams: { codec: 'h264', quality: 'high', fileName: 'nodecine.mp4', resolution: '1080p' },
  defaultBypassed: true,
  preflight: sceneSupportPreflight,
  run: async ({ params, inputs, services, signal, log, progress }) => {
    const ir = inputs.ir!.payload as VideoIR;
    const engine = inputs.engine!.payload as EngineRef;
    const fileName = safeFileName(params.fileName, 'nodecine.mp4');
    log('info', `start · ${params.codec} · ${params.quality} · ${params.resolution} · ${fileName}`);
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

const PosterParams = z.object({
  /** Where in the film the cover comes from. Clamped into the film at run time. */
  atSeconds: z.number().min(0).max(3600).default(1),
  fileName: z.string().min(1).max(80).default('nodecine'),
  resolution: z.enum(['1080p', '1440p', '2160p']).default('1080p'),
});

export const POSTER_EXPORT = 'core/poster-export';

/**
 * CORE_CONTRACTS §5.18 — one frame of the same composition, as a PNG cover.
 *
 * The thumbnail is what decides whether anyone plays the video at all, and picking one afterwards
 * means scrubbing an MP4 in another tool. Bypassed by default like the MP4: a still costs a headless
 * browser, so it waits to be asked.
 */
export const posterExport: NodeDefinition<typeof PosterParams> = {
  type: POSTER_EXPORT,
  version: 1,
  kind: 'ondemand',
  inputs: [
    { name: 'ir', type: 'VideoIR' },
    { name: 'engine', type: 'EngineRef', requires: ['render'] },
  ],
  outputs: [],
  paramsSchema: PosterParams,
  defaultParams: { atSeconds: 1, fileName: 'nodecine', resolution: '1080p' },
  defaultBypassed: true,
  preflight: sceneSupportPreflight,
  run: async ({ params, inputs, services, signal, log }) => {
    const ir = inputs.ir!.payload as VideoIR;
    const engine = inputs.engine!.payload as EngineRef;
    const atSeconds = Math.min(params.atSeconds, ir.meta.totalDurationInFrames / ir.meta.fps);
    const fileName = safeFileName(params.fileName, 'nodecine', 'png');
    log('info', `start · ${atSeconds.toFixed(2)}s · ${params.resolution} · ${fileName}`);
    const result = await services.capture(engine, ir, { atSeconds, resolution: params.resolution }, signal);
    log('info', `done · ${result.bytes} bytes · ${result.outputUrl}`);
    return { ...result, fileName, atSeconds };
  },
};
