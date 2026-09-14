import { beforeEach, describe, expect, it } from 'vitest';
import { layoutGraph } from '../layout';
import type { Graph } from '@/core/engine/graph';
import { registerNodes } from '@/nodes';
import { _resetNodeRegistry } from '@/core/nodes/definition';

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

beforeEach(() => {
  _resetNodeRegistry();
  registerNodes();
});

describe('layoutGraph', () => {
  const at = { x: 0, y: 0 };
  const node = (id: string, type: string) => ({ id, type, params: {}, bypassed: false, position: at });
  const graph: Graph = {
    nodes: [node('export', 'core/caption-export'), node('transcribe', 'core/transcribe'), node('tts', 'core/tts-engine'), node('mp4', 'core/mp4-export')],
    edges: [
      { id: 'e1', source: 'tts', sourcePort: 'voiceover', target: 'transcribe', targetPort: 'voiceover' },
      { id: 'e2', source: 'transcribe', sourcePort: 'captions', target: 'export', targetPort: 'captions' },
    ],
  };
  const sizes = Object.fromEntries(graph.nodes.map((n) => [n.id, { width: 220, height: n.type === 'core/transcribe' ? 320 : 180 }]));

  it('lays the flow out left to right along its wires without overlaps', () => {
    const pos = layoutGraph(graph, sizes);
    expect(Object.keys(pos)).toHaveLength(graph.nodes.length);
    for (const e of graph.edges) expect(pos[e.source]!.x, `${e.source} → ${e.target}`).toBeLessThan(pos[e.target]!.x);
    const boxes = graph.nodes.map((n) => ({ ...pos[n.id]!, w: sizes[n.id]!.width, h: sizes[n.id]!.height }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i]!, boxes[j]!), `${graph.nodes[i]!.id} vs ${graph.nodes[j]!.id}`).toBe(false);
    expect(Math.min(...boxes.map((b) => b.x))).toBeGreaterThanOrEqual(0);
  });

  it('lays the whole pipeline along one path, left to right', () => {
    // There used to be a second shape here: resource nodes hanging in a band below their consumer.
    // A model or an engine is a node's own setting now (§1.3), so every node is on the path.
    const pos = layoutGraph(graph, sizes);
    expect(pos.transcribe!.x).toBeGreaterThan(pos.tts!.x);
    expect(pos.transcribe!.x).toBeLessThan(pos.export!.x);
    for (const id of Object.keys(sizes)) expect(pos[id], `${id} was left unplaced`).toBeDefined();
  });

  it('copes with nodes that have no wires and no measured size', () => {
    const pos = layoutGraph({ nodes: [{ id: 'a', type: 'core/tts-engine', params: {}, bypassed: false, position: { x: 0, y: 0 } }, { id: 'b', type: 'core/tts-engine', params: {}, bypassed: false, position: { x: 0, y: 0 } }], edges: [] }, {});
    expect(pos.a!.y).not.toBe(pos.b!.y);
  });
});
