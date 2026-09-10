import type { Graph } from './graph';

/**
 * One graph in, several graphs out: a batch is the same workflow queued again and again with one
 * value different each time (EXECUTION_ENGINE §9). ComfyUI's shape — its Extra options queue the
 * prompt N times and a widget's `control_after_generate` moves the value along between them — and
 * it fits because the job queue already runs one graph at a time and keeps each run in its history.
 *
 * The alternative, n8n's, is that every packet is a list and every node runs once per item. That is
 * not available to us: `facts.items` already means "one item, one *scene*", which is what the AI
 * news template is built on. Both readings of a list cannot live in the same engine.
 *
 * What moves along here is an Input Trigger marked `perRun`: each of its lines becomes a run. Pure,
 * so what a batch will do can be read without submitting anything.
 */
/** The lines of a marked Input Trigger, blank ones dropped. */
export function batchLines(params: Record<string, unknown>): string[] {
  if (params.perRun !== true) return [];
  return String(params.value ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** How many runs pressing Run will queue, and which nodes decide that. */
export function batchPlan(graph: Graph): { runs: number; nodeIds: string[]; counts: number[] } {
  const marked = graph.nodes.filter((n) => batchLines(n.params).length > 0);
  const counts = marked.map((n) => batchLines(n.params).length);
  return { runs: counts.length ? Math.max(...counts) : 1, nodeIds: marked.map((n) => n.id), counts };
}

/**
 * The graphs to queue, in order. One graph back means an ordinary run and the caller need not know
 * a batch existed. A marked node with fewer lines than the longest holds its last line for the rest
 * of the batch, rather than the run count collapsing to the shortest — and `batchPlan` reports the
 * counts so the UI can say when two of them disagree.
 */
export function expandBatch(graph: Graph): Graph[] {
  const { runs, nodeIds } = batchPlan(graph);
  if (runs <= 1 || nodeIds.length === 0) return [graph];
  return Array.from({ length: runs }, (_, i) => ({
    ...graph,
    nodes: graph.nodes.map((n) => {
      if (!nodeIds.includes(n.id)) return n;
      const lines = batchLines(n.params);
      return { ...n, params: { ...n.params, value: lines[Math.min(i, lines.length - 1)]! } };
    }),
  }));
}
