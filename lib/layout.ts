import dagre from '@dagrejs/dagre';
import type { Graph } from '@/core/engine/graph';

/**
 * Tidy positions for a graph: left to right along the wires, layered by dagre (the layout React
 * Flow's own docs point to), sources at the left and outputs at the right, nodes spaced by their
 * measured size so nothing overlaps. Pure: positions in, positions out.
 */
export interface NodeSize { width: number; height: number }

export function layoutGraph(graph: Graph, sizes: Record<string, NodeSize>, opts: { nodesep?: number; ranksep?: number } = {}): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: opts.nodesep ?? 40, ranksep: opts.ranksep ?? 110, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of graph.nodes) {
    const size = sizes[n.id] ?? { width: 196, height: 160 };
    g.setNode(n.id, { width: size.width, height: size.height });
  }
  for (const e of graph.edges) if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  dagre.layout(g);
  const out: Record<string, { x: number; y: number }> = {};
  for (const n of graph.nodes) {
    const p = g.node(n.id);
    const size = sizes[n.id] ?? { width: 196, height: 160 };
    // dagre reports centres; React Flow positions are top-left corners.
    out[n.id] = { x: Math.round(p.x - size.width / 2), y: Math.round(p.y - size.height / 2) };
  }
  return out;
}
