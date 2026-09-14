import { PlateSheetSchema, StyleSheetSchema, type Plate, type StyleSheet } from '../types/payloads';
import type { Graph } from '@/core/engine/graph';
import { getNodeType } from '@/core/nodes/definition';
import { signatureKey } from './plates';

/**
 * The workflow's own store of plates: every layout it has drawn, gathered from its graph.
 *
 * The store belongs to the workflow, the way its style and its cast do — a plate is drawn against
 * one style sheet and means nothing beside another. What this adds is one place to see all of them
 * at a size worth judging, instead of as thumbnails on a single card.
 *
 * Pure, and given a graph rather than a file: the graph on the canvas is the workflow.
 */

/** One plate as the store shows it: the drawing, and the sheet it has to be drawn against. */
export interface StoredPlate {
  /** The node holding it: where to go to draw it again. */
  nodeId: string;
  plate: Plate;
  /** The style it was drawn in. Without it the markup is a layout nobody can render. */
  style: StyleSheet;
  /** The shape it draws, as one string: two plates with the same one are the same shape. */
  signature: string;
}

/** What a port is carrying: the last run's output, or what a pin holds. */
export type PortPayload = (nodeId: string, port: string) => unknown;

/**
 * Which nodes these are is read off the ports, never off a node's name: any node that emits a
 * PlateSheet holds plates, and any node feeding a StyleSheet into it says what they were drawn
 * against. A name written here would tie the core to two capsules and go stale the day either is
 * renamed.
 */
const portType = (type: string, port: string, side: 'inputs' | 'outputs'): string | undefined =>
  getNodeType(type)?.[side].find((p) => p.name === port)?.type;

/**
 * The style a plate maker was drawing against: the sheet on its StyleSheet input, followed upstream.
 *
 * The wire, not the nearest node that has a sheet, because a graph may hold several — and a plate
 * drawn against one sheet rendered against another is a layout with the wrong type and the wrong
 * colours, which reads as a plate that came out badly rather than one shown wrong.
 */
function styleFor(graph: Graph, node: { id: string; type: string }, payload: PortPayload): StyleSheet | undefined {
  for (const edge of graph.edges) {
    if (edge.target !== node.id || portType(node.type, edge.targetPort, 'inputs') !== 'StyleSheet') continue;
    const parsed = StyleSheetSchema.safeParse(payload(edge.source, edge.sourcePort));
    if (parsed.success) return parsed.data;
  }
  return undefined;
}

/** What the graph's pins hold: what a workflow shows before it has been run in this session. */
export const pinnedPayload = (graph: Graph): PortPayload => (nodeId, port) =>
  graph.nodes.find((n) => n.id === nodeId)?.pinned?.outputs[port];

/**
 * Every plate this workflow holds, in the order its nodes hold them.
 *
 * `payload` says where a port's value comes from: the run that just happened, or the pin. A plate
 * with no sheet behind it stays out, because the store's promise is that everything in it can be
 * looked at.
 */
export function platesInGraph(graph: Graph, payload: PortPayload): StoredPlate[] {
  const out: StoredPlate[] = [];
  const seen = new Set<string>();
  for (const node of graph.nodes) {
    const def = getNodeType(node.type);
    if (!def) continue;
    for (const port of def.outputs) {
      if (port.type !== 'PlateSheet') continue;
      const sheet = PlateSheetSchema.safeParse(payload(node.id, port.name));
      const style = styleFor(graph, node, payload);
      if (!sheet.success || !style) continue;
      for (const plate of sheet.data.plates) {
        // Two plate makers in one graph drawing the same shape in one style is one plate.
        const key = `${style.style.name}::${plate.source}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ nodeId: node.id, plate, style, signature: signatureKey(plate.keys) });
      }
    }
  }
  return out;
}
