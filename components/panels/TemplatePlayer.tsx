import type { Graph } from '@/core/engine/graph';
import { FRAME_PRESETS } from '@/core/visual/frame';

/**
 * What the card says a template makes: the shape of its frame and how many frames a second, read
 * from the graph — the ratio from the Illustrator, the rate from the Timeline Assembler — both
 * absent on a template that has neither. A hardcoded "9:16" was right for four templates and a
 * lie about the fifth.
 */
export function shapeOfTemplate(graph: Graph): { ratio: string; fps: number } | null {
  const node = graph.nodes.find((n) => n.type === 'core/illustrator');
  const preset = FRAME_PRESETS.find((p) => p.id === (node?.params as { frame?: unknown } | undefined)?.frame);
  if (!preset) return null;
  const fps = graph.nodes.find((n) => n.type === 'core/timeline-assembler')?.params.fps;
  return { ratio: preset.id, fps: typeof fps === 'number' ? fps : 30 };
}
