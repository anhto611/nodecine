import { ErrorCode } from '../errors';
import { getNodeType, type AnyNodeDefinition, type NodeIssue } from '../nodes/definition';

/** Serializable graph document (EXECUTION_ENGINE §7.1). */
export interface NodeInstance {
  id: string;
  type: string;
  params: Record<string, unknown>;
  bypassed: boolean;
  position: { x: number; y: number };
}

export interface Edge {
  id: string;
  source: string;
  sourcePort: string;
  target: string;
  targetPort: string;
}

export interface Graph {
  nodes: NodeInstance[];
  edges: Edge[];
}

export interface GraphIssue extends NodeIssue {
  nodeId?: string;
  edgeIds?: string[];
  severity: 'error' | 'warning';
}

export class GraphInvalidError extends Error {
  constructor(public readonly issues: GraphIssue[]) {
    super(`Graph invalid: ${issues.map((i) => i.code).join(', ')}`);
    this.name = 'GraphInvalidError';
  }
}

export function nodeById(graph: Graph, id: string): NodeInstance | undefined {
  return graph.nodes.find((n) => n.id === id);
}

export function incomingEdges(graph: Graph, nodeId: string): Edge[] {
  return graph.edges.filter((e) => e.target === nodeId);
}

export function outgoingEdges(graph: Graph, nodeId: string): Edge[] {
  return graph.edges.filter((e) => e.source === nodeId);
}

/** All nodes reachable downstream of `nodeId` (excluding itself). */
export function downstreamOf(graph: Graph, nodeId: string): string[] {
  const seen = new Set<string>();
  const stack = [nodeId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const e of outgoingEdges(graph, cur)) {
      if (!seen.has(e.target)) {
        seen.add(e.target);
        stack.push(e.target);
      }
    }
  }
  return [...seen];
}

/** Kahn's algorithm. Returns the order, or the edges participating in a cycle. */
export function topoSort(graph: Graph): { order: string[] } | { cycleEdges: string[] } {
  const indeg = new Map<string, number>();
  for (const n of graph.nodes) indeg.set(n.id, 0);
  for (const e of graph.edges) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);

  const queue = graph.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const e of outgoingEdges(graph, id)) {
      const d = (indeg.get(e.target) ?? 0) - 1;
      indeg.set(e.target, d);
      if (d === 0) queue.push(e.target);
    }
  }
  if (order.length !== graph.nodes.length) {
    const remaining = new Set(graph.nodes.map((n) => n.id).filter((id) => !order.includes(id)));
    const cycleEdges = graph.edges.filter((e) => remaining.has(e.source) && remaining.has(e.target)).map((e) => e.id);
    return { cycleEdges };
  }
  return { order };
}

/**
 * Continuous graph validation (EXECUTION_ENGINE §2). Errors disable Run; warnings do not.
 */
export function validateGraph(graph: Graph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const defs = new Map<string, AnyNodeDefinition>();

  for (const n of graph.nodes) {
    const def = getNodeType(n.type);
    if (!def) {
      issues.push({ severity: 'error', nodeId: n.id, code: ErrorCode.NODE_TYPE_UNKNOWN, message: `Unknown node type "${n.type}"` });
      continue;
    }
    defs.set(n.id, def);
    const parsed = def.paramsSchema.safeParse(n.params);
    if (!parsed.success) {
      issues.push({
        severity: 'error',
        nodeId: n.id,
        code: ErrorCode.NODE_PARAMS_INVALID,
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    } else if (def.validate) {
      for (const issue of def.validate(parsed.data)) issues.push({ severity: 'error', nodeId: n.id, ...issue });
    }
  }

  const sorted = topoSort(graph);
  if ('cycleEdges' in sorted) {
    issues.push({ severity: 'error', code: ErrorCode.GRAPH_CYCLE, message: 'The graph contains a cycle', edgeIds: sorted.cycleEdges });
  }

  for (const n of graph.nodes) {
    const def = defs.get(n.id);
    if (!def || n.bypassed) continue;
    const incoming = incomingEdges(graph, n.id);
    for (const port of def.inputs) {
      const edges = incoming.filter((e) => e.targetPort === port.name);
      if (edges.length === 0 && port.required !== false) {
        issues.push({
          severity: 'error',
          nodeId: n.id,
          port: port.name,
          code: port.type === 'LLMRef' || port.type === 'TTSRef' || port.type === 'EngineRef' ? ErrorCode.PROVIDER_NOT_CONNECTED : ErrorCode.GRAPH_PORT_UNCONNECTED,
          message: `Input "${port.name}" is not connected`,
        });
      }
      if (edges.length > 1 && !port.multiple) {
        issues.push({ severity: 'error', nodeId: n.id, port: port.name, code: ErrorCode.GRAPH_PORT_UNCONNECTED, message: `Input "${port.name}" has more than one edge`, edgeIds: edges.map((e) => e.id) });
      }
      for (const e of edges) {
        const srcDef = defs.get(e.source);
        const srcPort = srcDef?.outputs.find((o) => o.name === e.sourcePort);
        if (srcPort && srcPort.type !== port.type) {
          issues.push({ severity: 'error', nodeId: n.id, port: port.name, code: ErrorCode.GRAPH_PORT_TYPE_MISMATCH, message: `Edge ${e.id}: ${srcPort.type} → ${port.type}`, edgeIds: [e.id] });
        }
      }
    }
  }

  const hasSink = graph.nodes.some((n) => {
    const def = defs.get(n.id);
    return def && (def.kind === 'sink' || def.kind === 'ondemand') && incomingEdges(graph, n.id).length > 0;
  });
  if (graph.nodes.length > 0 && !hasSink) {
    issues.push({ severity: 'warning', code: ErrorCode.GRAPH_NO_SINK, message: 'No Video Output or MP4 Export node is connected' });
  }

  return issues;
}

export function hasBlockingIssues(issues: GraphIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
