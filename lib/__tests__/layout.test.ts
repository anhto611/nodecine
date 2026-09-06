import { beforeEach, describe, expect, it } from 'vitest';
import { layoutGraph } from '../layout';
import githubShowcase from '@/templates/github-showcase.json';
import { edgeKind, type Graph } from '@/core/engine/graph';
import { registerNodes } from '@/nodes';
import { _resetNodeRegistry } from '@/core/nodes/definition';

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

beforeEach(() => {
  _resetNodeRegistry();
  registerNodes();
});

describe('layoutGraph', () => {
  const graph = githubShowcase.graph as Graph;
  const sizes = Object.fromEntries(graph.nodes.map((n) => [n.id, { width: 220, height: n.type === 'core/art-director' ? 420 : 180 }]));

  it('lays the flow out left to right along its wires without overlaps', () => {
    const pos = layoutGraph(graph, sizes);
    expect(Object.keys(pos)).toHaveLength(graph.nodes.length);
    for (const e of graph.edges.filter((e) => edgeKind(graph, e) === 'flow')) expect(pos[e.source]!.x, `${e.source} → ${e.target}`).toBeLessThan(pos[e.target]!.x);
    const boxes = graph.nodes.map((n) => ({ ...pos[n.id]!, w: sizes[n.id]!.width, h: sizes[n.id]!.height }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i]!, boxes[j]!), `${graph.nodes[i]!.id} vs ${graph.nodes[j]!.id}`).toBe(false);
    expect(Math.min(...boxes.map((b) => b.x))).toBeGreaterThanOrEqual(0);
  });

  it('hangs each resource node directly above the node that uses it, and keeps the Art Director in the flow', () => {
    const pos = layoutGraph(graph, sizes);
    // The Art Director sits between the screenwriter and the assembler on the main path, not above anything.
    expect(pos['art-director']!.x).toBeGreaterThan(pos.screenwriter!.x);
    expect(pos['art-director']!.x).toBeLessThan(pos.assembler!.x);
    // llm-provider feeds the screenwriter; tts-provider feeds tts; engine feeds output (its first consumer).
    for (const [resource, consumer] of [['llm-provider', 'screenwriter'], ['tts-provider', 'tts'], ['engine', 'output']] as const) {
      const r = pos[resource]!, c = pos[consumer]!;
      expect(r.y + sizes[resource]!.height, `${resource} above ${consumer}`).toBeLessThanOrEqual(c.y);
      // Horizontally within the consumer's slot: no wire runs backwards across the canvas.
      expect(r.x, `${resource} starts with ${consumer}`).toBeGreaterThanOrEqual(c.x);
    }
  });

  it('copes with nodes that have no wires and no measured size', () => {
    const pos = layoutGraph({ nodes: [{ id: 'a', type: 'core/input-trigger', params: {}, bypassed: false, position: { x: 0, y: 0 } }, { id: 'b', type: 'core/input-trigger', params: {}, bypassed: false, position: { x: 0, y: 0 } }], edges: [] }, {});
    expect(pos.a!.y).not.toBe(pos.b!.y);
  });
});
