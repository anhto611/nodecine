import dagre from '@dagrejs/dagre';
import { edgeKind, type Graph } from '@/core/engine/graph';

/**
 * Tidy positions for a graph. The flow — content moving step by step along flow wires — runs left
 * to right, layered by dagre (the layout React Flow's own docs point to). Resource nodes (a look, a
 * model, a voice, an engine: nodes that only hand parts to others) are not part of that pipeline;
 * each hangs in a band directly above the first node that uses it, so a reader sees the path along
 * the middle and the parts plugged in from above. Pure: positions in, positions out.
 */
export interface NodeSize { width: number; height: number }

const DEFAULT_SIZE: NodeSize = { width: 220, height: 180 };
/** Gap between a resource node and the node below it, and between resource nodes in a band. */
const BAND_GAP = 56;
const BAND_SPACING = 24;

export function layoutGraph(graph: Graph, sizes: Record<string, NodeSize>, opts: { nodesep?: number; ranksep?: number } = {}): Record<string, { x: number; y: number }> {
  const sizeOf = (id: string) => sizes[id] ?? DEFAULT_SIZE;
  const flowEdges = graph.edges.filter((e) => edgeKind(graph, e) === 'flow');
  const touchesFlow = new Set(flowEdges.flatMap((e) => [e.source, e.target]));

  // A resource node hands out parts and takes no part in the flow. It hangs above its first consumer.
  const bands = new Map<string, string[]>();
  const hung = new Set<string>();
  for (const n of graph.nodes) {
    if (touchesFlow.has(n.id)) continue;
    const consumer = graph.edges.find((e) => e.source === n.id && edgeKind(graph, e) === 'resource' && e.target !== n.id);
    if (!consumer) continue;
    hung.add(n.id);
    bands.set(consumer.target, [...(bands.get(consumer.target) ?? []), n.id]);
  }
  // A consumer that is itself hung (a resource of a resource) keeps its own band; dagre never sees it.
  for (const [consumer, ids] of bands) if (hung.has(consumer)) { for (const id of ids) hung.delete(id); bands.delete(consumer); }

  const bandOf = (id: string) => {
    const ids = bands.get(id) ?? [];
    const width = ids.reduce((w, r) => w + sizeOf(r).width, 0) + Math.max(0, ids.length - 1) * BAND_SPACING;
    const height = ids.length ? Math.max(...ids.map((r) => sizeOf(r).height)) + BAND_GAP : 0;
    return { ids, width, height };
  };

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: opts.nodesep ?? 40, ranksep: opts.ranksep ?? 110, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of graph.nodes) {
    if (hung.has(n.id)) continue;
    const size = sizeOf(n.id);
    const band = bandOf(n.id);
    // The slot dagre reserves is the node plus the band of parts above it.
    g.setNode(n.id, { width: Math.max(size.width, band.width), height: size.height + band.height });
  }
  for (const e of flowEdges) if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  dagre.layout(g);

  const out: Record<string, { x: number; y: number }> = {};
  for (const n of graph.nodes) {
    if (hung.has(n.id)) continue;
    const p = g.node(n.id);
    const size = sizeOf(n.id);
    const band = bandOf(n.id);
    // dagre reports the centre of the slot; the node sits at the bottom of it, left-aligned.
    const slotLeft = p.x - Math.max(size.width, band.width) / 2;
    const slotTop = p.y - (size.height + band.height) / 2;
    out[n.id] = { x: Math.round(slotLeft), y: Math.round(slotTop + band.height) };
    let x = slotLeft;
    for (const r of band.ids) {
      // Parts sit on a common baseline just above the node, so each wire drops straight down.
      out[r] = { x: Math.round(x), y: Math.round(slotTop + band.height - BAND_GAP - sizeOf(r).height) };
      x += sizeOf(r).width + BAND_SPACING;
    }
  }
  return out;
}
