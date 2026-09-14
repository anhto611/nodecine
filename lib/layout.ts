import dagre from '@dagrejs/dagre';
import type { Graph } from '@/core/engine/graph';

/**
 * Tidy positions for a graph: content moves step by step along the wires, left to right, layered by
 * dagre (the layout React Flow's own docs point to). Pure: positions in, positions out.
 *
 * There used to be a second shape here — a band of resource nodes hanging below the node that used
 * them, the way an n8n sub-node hangs under its consumer. A model or an engine is a thing a node
 * names for itself now, so every node is on the path and there is one shape.
 */
export interface NodeSize { width: number; height: number }

const DEFAULT_SIZE: NodeSize = { width: 220, height: 180 };

export function layoutGraph(graph: Graph, sizes: Record<string, NodeSize>, opts: { nodesep?: number; ranksep?: number } = {}): Record<string, { x: number; y: number }> {
  const sizeOf = (id: string) => sizes[id] ?? DEFAULT_SIZE;

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: opts.nodesep ?? 40, ranksep: opts.ranksep ?? 110, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));
  // A copy per node: dagre writes the position into the object it is handed, and two nodes given
  // the same default object would come back sharing one position.
  for (const n of graph.nodes) g.setNode(n.id, { ...sizeOf(n.id) });
  for (const e of graph.edges) if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  dagre.layout(g);

  const out: Record<string, { x: number; y: number }> = {};
  for (const n of graph.nodes) {
    const p = g.node(n.id);
    const size = sizeOf(n.id);
    // dagre reports the centre of the slot; the node sits at its top left.
    out[n.id] = { x: Math.round(p.x - size.width / 2), y: Math.round(p.y - size.height / 2) };
  }
  return out;
}
