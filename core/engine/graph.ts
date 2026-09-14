import { ErrorCode } from '../errors';
import { getNodeType, type AnyNodeDefinition, type NodeIssue } from '../nodes/definition';

/** Serializable graph document. */
/**
 * Freeze a node's last outputs into the graph, and thaw them again.
 *
 * `outputs` is the node's runtime outputs, so a pin is always something that actually ran and was
 * looked at. A port that produced nothing is not pinned, and a node that produced nothing at all is
 * left alone rather than given a pin that holds air.
 */
export function pinNode(graph: Graph, nodeId: string, outputs: Record<string, { payload: unknown }>, at: string): Graph {
  const entries = Object.entries(outputs).filter(([, p]) => p?.payload !== undefined).map(([port, p]) => [port, p.payload] as const);
  if (!entries.length) return graph;
  const pinned = { outputs: Object.fromEntries(entries), at };
  return { ...graph, nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, pinned } : n)) };
}

export function unpinNode(graph: Graph, nodeId: string): Graph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      if (n.id !== nodeId || !n.pinned) return n;
      const { pinned: _thawed, ...rest } = n;
      return rest;
    }),
  };
}

export interface NodeInstance {
  id: string;
  type: string;
  params: Record<string, unknown>;
  bypassed: boolean;
  position: { x: number; y: number };
  /**
   * Which version of the node type wrote these parameters. Without it a later build cannot know
   * what it is looking at, so it cannot bring anything forward. Absent means the first version:
   * a graph saved before the stamp existed.
   */
  version?: number;
  /**
   * Outputs frozen into the graph: the node hands these back and does not run.
   *
   * A workflow used to keep only instructions — a sentence describing the look — and derive the look
   * again on every run. Two videos from one workflow were therefore two near-misses rather than one
   * house style, and the expensive half of the pipeline was paid for again every time. A pin is how a
   * result becomes part of the workflow: approve a style once, and every later run draws in it.
   */
  pinned?: { outputs: Record<string, unknown>; at: string };
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
 * The flow: every node with a wire on it.
 *
 * A node with nothing in any port and nothing leaving it is not part of the film. Dropping one from
 * the library and wiring it up takes several gestures, and in between it used to stop the whole
 * workflow from running, then report a failure after a run it was never part of. It is drawn with
 * its warning and otherwise left alone.
 */
export function flowNodes(graph: Graph): Set<string> {
  const wired = new Set<string>();
  for (const e of graph.edges) { wired.add(e.source); wired.add(e.target); }
  return wired;
}

/**
 * Whether there is anything to run: a node that takes no input at all, with its result wired into
 * something. Nothing else can begin a film, and a canvas of unwired cards has nothing to do.
 */
export function canRun(graph: Graph): boolean {
  return graph.nodes.some((n) => {
    const def = getNodeType(n.type);
    if (!def || n.bypassed || def.inputs.length > 0) return false;
    return graph.edges.some((e) => e.source === n.id);
  });
}

/**
 * Continuous graph validation. Errors disable Run; warnings do not.
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
      for (const issue of def.validate(parsed.data)) issues.push({ severity: 'warning', nodeId: n.id, ...issue });
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
      // A pinned node hands back what the graph keeps and never runs, so it never reads this port.
      // Warning about it is telling somebody to wire up an input nothing will ever look at — and
      // sometimes the only honest wire would close a cycle.
      if (edges.length === 0 && port.required !== false && !n.pinned) {
        issues.push({
          // Said on the node, not held against the run: a port with nothing in it stops that node
          // when the run reaches it, and says so there. Dropping a node from the library and wiring
          // it up takes several gestures, and in between it has required inputs with nothing in
          // them — that used to disable Run for the whole workflow.
          severity: 'warning',
          nodeId: n.id,
          port: port.name,
          code: ErrorCode.GRAPH_PORT_UNCONNECTED,
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
