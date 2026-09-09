import { z } from 'zod';
import { safeFileName } from '@/core/file-name';
import { coverAsBlock, coverGround, coverStage } from '@/core/look/cover';
import { ErrorCode } from '@/core/errors';
import { missingCodeRenderers } from '@/core/look/renderers';
import { coverProps, type CoverDef, type EngineRef } from '@/core/types/payloads';
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

const CoverParams = z.object({
  /** Which cover of the look to draw. Empty takes the first one it carries. */
  cover: z.string().max(60).default(''),
  /** What goes in that cover's own props, by name — a title, a picture, whatever it declares. */
  props: z.record(z.string(), z.unknown()).default({}),
  fileName: z.string().min(1).max(80).default('nodecine'),
  resolution: z.enum(['1080p', '1440p', '2160p']).default('1080p'),
});

export const COVER_EXPORT = 'core/cover-export';

/**
 * CORE_CONTRACTS §5.18 — a cover image, drawn from the look's own cover design.
 *
 * Not a frame of the video. Every platform already lets you scrub the video for a thumbnail; what
 * it cannot do is give you a picture made to be a cover — its own frame (a 16:9 video still wants a
 * 9:16 cover), its own words, its own composition. So this draws a `CoverDef` (§2.13), which is a
 * peer of the stage and the blocks and travels in the look like they do.
 *
 * How it renders: a one-frame video of one scene, at the cover's frame, with the cover playing the
 * part of the block and a bare stage carrying the real stage's palette and fonts — so the cover
 * looks like the film without inheriting a layout measured for another shape. Then the engine's own
 * capture takes the single frame.
 */
export const coverExport: NodeDefinition<typeof CoverParams> = {
  type: COVER_EXPORT,
  version: 2,
  kind: 'ondemand',
  inputs: [
    { name: 'ir', type: 'VideoIR' },
    { name: 'engine', type: 'EngineRef', requires: ['render'] },
  ],
  outputs: [],
  paramsSchema: CoverParams,
  defaultParams: { cover: '', props: {}, fileName: 'nodecine', resolution: '1080p' },
  defaultBypassed: true,
  preflight: sceneSupportPreflight,
  run: async ({ params, inputs, services, signal, log }) => {
    const ir = inputs.ir!.payload as VideoIR;
    const engine = inputs.engine!.payload as EngineRef;
    const cover = coverFrom(ir, params.cover);
    if (!cover) {
      throw Object.assign(new Error('this look carries no cover design'), {
        code: ErrorCode.NODE_PARAMS_INVALID,
        fix: 'add one in the Art Director, under Covers',
      });
    }
    const fileName = safeFileName(params.fileName, 'nodecine', 'png');
    log('info', `${cover.name} · ${cover.frame.width}×${cover.frame.height} · ${params.resolution} · ${fileName}`);
    // Nothing chosen for the ground: take the film's own opening shot, so a template whose footage
    // changes every run gets a cover that belongs to that run without anybody opening a picker.
    let props = coverProps(cover, params.props);
    const ground = coverGround(cover, props, ir.timeline, ir.blocks);
    if (ground && 'image' in ground) {
      props = { ...props, [ground.prop]: ground.image };
      log('info', `ground: the picture of the first scene`);
    } else if (ground) {
      // A second in, not the first frame: scenes fade up from black, and frame zero of a clip is
      // often its darkest.
      const still = await services.stillFromVideo(ground.clip, 1, signal);
      props = { ...props, [ground.prop]: still };
      log('info', `ground: a frame of the first scene's clip · ${still}`);
    }
    const result = await services.capture(engine, coverIR(ir, cover, props), { atSeconds: 0, resolution: params.resolution }, signal);
    log('info', `done · ${result.bytes} bytes · ${result.outputUrl}`);
    return { ...result, fileName, coverId: cover.id };
  },
};

/** The cover asked for, or the first the look carries. */
export function coverFrom(ir: Pick<VideoIR, 'covers'>, id: string): CoverDef | undefined {
  const covers = ir.covers ?? [];
  return (id && covers.find((c) => c.id === id)) || covers[0];
}

/**
 * The cover as a one-frame film, so it can go down the same road the video does.
 *
 * The stage and the block shape both come from `core/look/cover.ts`, which is also what the Art
 * Director previews a cover through — one definition, so what you see while designing is what the
 * file comes out as.
 */
export function coverIR(ir: VideoIR, cover: CoverDef, props: Record<string, unknown>): VideoIR {
  const filled = coverProps(cover, props);
  return {
    ...ir,
    meta: { ...ir.meta, title: cover.name, fps: 1, width: cover.frame.width, height: cover.frame.height, totalDurationInFrames: 1 },
    stage: coverStage(ir.stage, cover),
    blocks: [coverAsBlock(cover)],
    timeline: [{ id: `cover-${cover.id}`, blockId: cover.id, startFrame: 0, durationInFrames: 1, props: filled }],
    captions: undefined,
  };
}
