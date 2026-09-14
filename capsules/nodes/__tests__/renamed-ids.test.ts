import { beforeEach, describe, expect, it } from 'vitest';
import { registerNodes } from '@/capsules/nodes';
import { _resetNodeRegistry } from '@/core/nodes/definition';
import { _resetDocMigrations, migrateGraph } from '@/core/engine/migrate';
import { validateGraph, type Graph } from '@/core/engine/graph';

/**
 * Node ids lost their `core/` prefix on 2026-09-14: `core` is the name of the runtime layer, and a
 * word may mean one thing. Every workflow saved before then names the old ids, so each is recorded
 * as a rename in `capsules/retired.json` and must open as the same node, settings and version intact.
 */

beforeEach(() => {
  _resetNodeRegistry();
  _resetDocMigrations();
  registerNodes();
});

const at = { x: 0, y: 0 };
const saved: Graph = {
  nodes: [
    { id: 'voice', type: 'core/tts-engine', version: 1, params: { ttsProvider: 'system-tts', ttsSettings: {}, speed: 1.2 }, bypassed: false, position: at },
    { id: 'align', type: 'core/transcribe', version: 2, params: { model: 'large-v3' }, bypassed: false, position: at },
    { id: 'subs', type: 'core/caption-export', version: 1, params: { format: 'vtt', fileName: 'phụ đề' }, bypassed: false, position: at },
    { id: 'player', type: 'core/video-output', params: { engineId: 'hyperframes' }, bypassed: false, position: at },
    { id: 'mp4', type: 'core/mp4-export', params: {}, bypassed: true, position: at },
  ],
  edges: [
    { id: 'e1', source: 'voice', sourcePort: 'voiceover', target: 'align', targetPort: 'voiceover' },
    { id: 'e2', source: 'align', sourcePort: 'captions', target: 'subs', targetPort: 'captions' },
  ],
};

describe('a workflow saved with the old node ids', () => {
  it('opens with the new ids, every setting and version as it was, and its wires intact', () => {
    const { graph, notes } = migrateGraph(structuredClone(saved));
    expect(graph.nodes.map((n) => n.type)).toEqual(['tts', 'transcribe', 'caption-export', 'video-output', 'mp4-export']);
    // Transcribe is at version 2: a rename must not run its own migration from version 1 again.
    expect(graph.nodes[1]).toMatchObject({ version: 2, params: { model: 'large-v3' } });
    expect(graph.nodes[0]!.params).toMatchObject({ speed: 1.2 });
    expect(graph.nodes[2]!.params).toMatchObject({ fileName: 'phụ đề' });
    expect(graph.edges).toEqual(saved.edges);
    expect(notes.filter((n) => n.code === 'NODE_RENAMED')).toHaveLength(5);
    expect(validateGraph(graph).filter((i) => i.code === 'NODE_TYPE_UNKNOWN' || i.code === 'NODE_PARAMS_INVALID')).toEqual([]);
  });
});
