import { beforeEach, describe, expect, it } from 'vitest';
import { registerNodes } from '@/capsules/nodes';
import { _resetNodeRegistry } from '@/core/nodes/definition';
import { _resetDocMigrations, migrateGraph } from '@/core/engine/migrate';
import { validateGraph, type Graph } from '@/core/engine/graph';

/** Data Merge took caption lines until 2026-09-15. A workflow wired that way opens without the wire, and still valid. */

beforeEach(() => {
  _resetNodeRegistry();
  _resetDocMigrations();
  registerNodes();
});

describe('a workflow that wired captions into Data Merge', () => {
  it('opens without that wire, keeping the one into Caption Export', () => {
    const at = { x: 0, y: 0 };
    const graph: Graph = {
      nodes: [
        { id: 'align', type: 'transcribe', version: 2, params: {}, bypassed: false, position: at },
        { id: 'comp', type: 'composition', version: 1, params: { files: { 'index.html': '<html></html>' }, media: {} }, bypassed: false, position: at },
        { id: 'merge', type: 'fill', version: 1, params: { values: {} }, bypassed: false, position: at },
        { id: 'subs', type: 'caption-export', version: 1, params: {}, bypassed: false, position: at },
      ],
      edges: [
        { id: 'e1', source: 'comp', sourcePort: 'composition', target: 'merge', targetPort: 'composition' },
        { id: 'e2', source: 'align', sourcePort: 'captions', target: 'merge', targetPort: 'captions' },
        { id: 'e3', source: 'align', sourcePort: 'captions', target: 'subs', targetPort: 'captions' },
      ],
    };
    const { graph: after, notes } = migrateGraph(graph);
    expect(after.edges.map((e) => e.id)).toEqual(['e1', 'e3']);
    expect(notes.some((n) => n.nodeId === 'merge')).toBe(true);
    expect(validateGraph(after).filter((i) => i.code === 'GRAPH_PORT_TYPE_MISMATCH' || i.severity === 'error')).toEqual([]);
  });
});
