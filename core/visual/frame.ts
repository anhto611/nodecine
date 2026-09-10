import type { Graph } from '../engine/graph';

/**
 * The video's frame size is the Illustrator's `frame` parameter (a preset id): the scenes it draws are
 * drawn for that frame, and the Assembler takes the video's size from the plan. Everything
 * that needs the size before a run — previews, the safe-zone guides, the prompt sent to a model —
 * reads the same parameter. No Illustrator in the graph: portrait.
 */
export interface FrameSize { width: number; height: number }

export const DEFAULT_FRAME: FrameSize = { width: 1080, height: 1920 };

/**
 * A plan picks a ratio. The numbers are the design coordinate system the code is written in (a
 * 1080-wide portrait frame, a 1080-tall landscape one); the pixels of the file are chosen at export.
 */
export const FRAME_PRESETS: { id: string; label: string; width: number; height: number }[] = [
  { id: '9:16', label: '9:16', width: 1080, height: 1920 },
  { id: '16:9', label: '16:9', width: 1920, height: 1080 },
  { id: '1:1', label: '1:1', width: 1080, height: 1080 },
  { id: '4:5', label: '4:5', width: 1080, height: 1350 },
];

/** Output resolutions, by the short side of the frame: 1080p is the design size itself. */
export const RESOLUTIONS = ['1080p', '1440p', '2160p'] as const;
export type Resolution = (typeof RESOLUTIONS)[number];
const SHORT_SIDE: Record<Resolution, number> = { '1080p': 1080, '1440p': 1440, '2160p': 2160 };

/** How much the design frame is scaled to reach the resolution: 1 for 1080p on a 1080-short-side frame. */
export function renderScaleFor(frame: FrameSize, resolution: Resolution = '1080p'): number {
  const short = Math.min(frame.width, frame.height);
  return Math.round((SHORT_SIDE[resolution] / short) * 10000) / 10000;
}

/** The pixel size of the file for a frame at a resolution, even numbers as encoders want them. */
export function outputSizeFor(frame: FrameSize, resolution: Resolution = '1080p'): FrameSize {
  const k = renderScaleFor(frame, resolution);
  const even = (n: number) => Math.round(n * k / 2) * 2;
  return { width: even(frame.width), height: even(frame.height) };
}

export function frameOf(graph: Pick<Graph, 'nodes'>): FrameSize {
  const id = graph.nodes.map((node) => (node.params as { frame?: unknown }).frame)
    .find((frame) => FRAME_PRESETS.some((preset) => preset.id === frame));
  const preset = FRAME_PRESETS.find((p) => p.id === id);
  return preset ? { width: preset.width, height: preset.height } : DEFAULT_FRAME;
}

export const describeFrame = (f: FrameSize): string => `${f.width}×${f.height} ${f.height > f.width ? 'portrait' : f.height === f.width ? 'square' : 'landscape'}`;
