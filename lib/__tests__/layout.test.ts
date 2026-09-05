import { describe, expect, it } from 'vitest';
import { layoutGraph } from '../layout';
import githubShowcase from '@/templates/github-showcase.json';
import type { Graph } from '@/core/engine/graph';

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('layoutGraph', () => {
  it('lays the GitHub template out left to right along its wires without overlaps', () => {
    const graph = githubShowcase.graph as Graph;
    const sizes = Object.fromEntries(graph.nodes.map((n) => [n.id, { width: 196, height: n.type === 'core/blocks' ? 420 : 180 }]));
    const pos = layoutGraph(graph, sizes);
    expect(Object.keys(pos)).toHaveLength(graph.nodes.length);
    for (const e of graph.edges) expect(pos[e.source]!.x, `${e.source} → ${e.target}`).toBeLessThan(pos[e.target]!.x);
    const boxes = graph.nodes.map((n) => ({ ...pos[n.id]!, w: sizes[n.id]!.width, h: sizes[n.id]!.height }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i]!, boxes[j]!), `${graph.nodes[i]!.id} vs ${graph.nodes[j]!.id}`).toBe(false);
    expect(Math.min(...boxes.map((b) => b.x))).toBeGreaterThanOrEqual(0);
  });

  it('copes with nodes that have no wires and no measured size', () => {
    const pos = layoutGraph({ nodes: [{ id: 'a', type: 'core/input-trigger', params: {}, bypassed: false, position: { x: 0, y: 0 } }, { id: 'b', type: 'core/input-trigger', params: {}, bypassed: false, position: { x: 0, y: 0 } }], edges: [] }, {});
    expect(pos.a!.y).not.toBe(pos.b!.y);
  });
});
