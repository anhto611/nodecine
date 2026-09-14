import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  migrateDoc,
  migrateGraph,
  stampVersions,
  readableSchemaVersions,
  registerDocMigration,
  _resetDocMigrations,
  DocVersionUnsupportedError,
  PROJECT_SCHEMA_VERSION,
  type SavedDoc,
} from '../engine/migrate';
import { validateGraph, hasBlockingIssues, type Graph } from '../engine/graph';
import { PAYLOAD_SCHEMAS } from '@/contracts/types/payloads';
import { _resetNodeRegistry, registerNodeType, registerRetiredNodeType, type AnyNodeDefinition } from '../nodes/definition';
import { registerNodes } from '@/nodes';
import perVendorProviders from './fixtures/format-1-per-vendor-providers.json';
import retiredNodes from './fixtures/format-2-retired-nodes.json';

/**
 * Real files, kept in the repo, from formats this build no longer writes. They are the only thing
 * that keeps a migration honest: a step nobody exercises rots exactly the way the state machine
 * table did, and the day it matters is the day somebody's workflow will not open.
 */

beforeEach(() => {
  _resetNodeRegistry();
  _resetDocMigrations();
  registerNodes();
});

describe('a file from an older format', () => {
  it('opens, and every node in it validates against the nodes of today', () => {
    const { doc, notes } = migrateDoc(structuredClone(perVendorProviders) as SavedDoc);
    expect(doc.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(notes[0]).toMatchObject({ code: 'DOC_FORMAT' });

    const types = doc.graph.nodes.map((n) => n.type);
    expect(types).not.toContain('core/system-tts-provider');
    expect(types).not.toContain('core/claude-code-provider');
    // Whatever else changed, the graph has to be one this build can run.
    for (const issue of validateGraph(doc.graph)) expect(issue.code, issue.message).not.toBe('NODE_TYPE_UNKNOWN');
    expect(validateGraph(doc.graph).some((i) => i.code === 'NODE_PARAMS_INVALID')).toBe(false);
  });

  it('carries the settings across, onto whatever was using them', () => {
    // Two steps in one pass: a per-vendor provider becomes the plain one, and the plain one is then
    // folded onto its consumer, because a model is a node's own setting now and not a node (§1.3).
    const doc0 = structuredClone(perVendorProviders) as SavedDoc;
    const g = doc0.graph as { nodes: unknown[]; edges: unknown[] };
    g.nodes.push({ id: 'writer', type: 'core/screenwriter', params: {}, bypassed: false, position: { x: 0, y: 0 } });
    g.edges.push({ id: 'e1', source: 'brain', sourcePort: 'llm', target: 'writer', targetPort: 'llm' });
    const { doc } = migrateDoc(doc0);
    expect(doc.graph.nodes.map((n) => n.id), 'a provider node survived the fold').not.toContain('brain');
    expect(doc.graph.edges, 'a wire to a node that is gone survived').toHaveLength(0);
    const writer = doc.graph.nodes.find((n) => n.id === 'writer')!;
    expect(writer.params).toMatchObject({ llmProvider: 'claude-code', llmSettings: { model: 'sonnet' } });
    // One nobody was using goes too, quietly: there is nothing left for it to hand out.
    expect(doc.graph.nodes.map((n) => n.id)).not.toContain('voice');
  });

  it('refuses a format with no way forward, and names the formats it does open', () => {
    const doc = { ...structuredClone(perVendorProviders), schemaVersion: 99 } as SavedDoc;
    expect(() => migrateDoc(doc)).toThrow(DocVersionUnsupportedError);
    expect(() => migrateDoc(doc)).toThrow(String(PROJECT_SCHEMA_VERSION));
    expect(readableSchemaVersions()).toContain(PROJECT_SCHEMA_VERSION);
    expect(readableSchemaVersions()).not.toContain(99);
  });
});

describe('a node type that is gone', () => {
  it('becomes the nodes that replaced it, and says so', () => {
    // The Art Director drew scenes, then the Illustrator did, and now a Set, a Plate Maker and a
    // Scene Builder do. A graph saved under the first name comes forward the whole way.
    const { notes, graph } = migrateGraph(structuredClone(retiredNodes.graph) as Graph);
    const art = graph.nodes.find((n) => n.id === 'art')!;
    expect(art.type).toBe('core/compose');
    expect(graph.nodes.map((n) => n.type)).toContain('core/plates');
    expect(graph.nodes.map((n) => n.type)).toContain('core/set');
    expect(notes.find((n) => n.code === 'NODE_REPLACED')?.message).toContain('core/art-director');
    for (const n of graph.nodes) {
      expect(hasBlockingIssues(validateGraph({ nodes: [n], edges: [] }).filter((i) => i.code === 'NODE_PARAMS_INVALID')), n.type).toBe(false);
    }
  });

  it('stays put when nothing replaced it, with a reason instead of an unknown type', () => {
    const { notes, graph } = migrateGraph(structuredClone(retiredNodes.graph) as Graph);
    expect(graph.nodes.find((n) => n.id === 'cover')!.type).toBe('core/cover-export');
    const gone = notes.find((n) => n.code === 'NODE_RETIRED');
    expect(gone?.message).toContain('nothing replaced it');
    expect(gone?.message).toContain('2026-09-10');
  });
});

describe('a node type whose parameters changed', () => {
  const Params = z.object({ headline: z.string().default('') });
  const register = (version: number, migrate?: AnyNodeDefinition['migrate']) => registerNodeType({
    type: 'test/renamed-field', version, kind: 'source', inputs: [], outputs: [],
    paramsSchema: Params, defaultParams: { headline: '' }, migrate,
    run: async () => ({}),
  } as unknown as AnyNodeDefinition);
  const saved = (version?: number): Graph => ({
    nodes: [{ id: 'n', type: 'test/renamed-field', version, params: { title: 'The old name' }, bypassed: false, position: { x: 0, y: 0 } }],
    edges: [],
  });

  it('is brought forward by the capsule that owns it', () => {
    register(2, (params) => ({ headline: params.title ?? '' }));
    const { graph, notes } = migrateGraph(saved(1));
    expect(graph.nodes[0]!.params).toEqual({ headline: 'The old name' });
    expect(graph.nodes[0]!.version).toBe(2);
    expect(notes.find((n) => n.code === 'NODE_VERSION')?.message).toContain('version 1 to 2');
  });

  it('treats a node saved before the stamp existed as the first version', () => {
    register(2, (params) => ({ headline: params.title ?? '' }));
    expect(migrateGraph(saved(undefined)).graph.nodes[0]!.params).toEqual({ headline: 'The old name' });
  });

  it('says which settings were lost when the capsule wrote no way forward', () => {
    register(2);
    const { graph, notes } = migrateGraph(saved(1));
    // `title` is not a field of this node any more. Zod would have dropped it in silence.
    expect(graph.nodes[0]!.params).toEqual({ headline: '' });
    expect(notes.find((n) => n.code === 'PARAMS_DROPPED')?.message).toContain('title');
  });

  it('falls back to the defaults when the parameters are not merely stale but wrong', () => {
    registerNodeType({
      type: 'test/strict', version: 2, kind: 'source', inputs: [], outputs: [],
      paramsSchema: z.object({ count: z.number().int().positive() }), defaultParams: { count: 3 },
      run: async () => ({}),
    } as unknown as AnyNodeDefinition);
    const { graph, notes } = migrateGraph({ nodes: [{ id: 'n', type: 'test/strict', version: 1, params: { count: -4 }, bypassed: false, position: { x: 0, y: 0 } }], edges: [] });
    expect(graph.nodes[0]!.params).toEqual({ count: 3 });
    expect(notes.find((n) => n.code === 'PARAMS_RESET')?.nodeId).toBe('n');
  });

  it('leaves a node that is already current exactly as it was, stamp and all', () => {
    register(1);
    const current: Graph = { nodes: [{ id: 'n', type: 'test/renamed-field', version: 1, params: { headline: 'fine' }, bypassed: false, position: { x: 0, y: 0 } }], edges: [] };
    expect(migrateGraph(structuredClone(current))).toEqual({ graph: current, notes: [] });
  });

  it('does not add a stamp to a node that needed nothing, so opening a file is not an edit', () => {
    register(1);
    const unstamped: Graph = { nodes: [{ id: 'n', type: 'test/renamed-field', params: { headline: 'fine' }, bypassed: false, position: { x: 0, y: 0 } }], edges: [] };
    expect(migrateGraph(structuredClone(unstamped)).graph).toEqual(unstamped);
  });
});

describe('saving', () => {
  it('stamps every node with the version that wrote its parameters', () => {
    registerRetiredNodeType('test/ghost', { since: '2026-01-01' });
    const graph: Graph = {
      nodes: [
        { id: 'a', type: 'core/input-trigger', params: { value: 'x' }, bypassed: false, position: { x: 0, y: 0 } },
        { id: 'b', type: 'test/ghost', params: {}, bypassed: false, position: { x: 0, y: 0 } },
      ],
      edges: [],
    };
    const stamped = stampVersions(graph);
    expect(stamped.nodes[0]!.version).toBe(1);
    // Nothing to stamp a type this build does not have; it goes to disk as it came.
    expect(stamped.nodes[1]!.version).toBeUndefined();
  });
});

describe('the migration chain itself', () => {
  it('refuses a step that leads nowhere', () => {
    expect(() => registerDocMigration(PROJECT_SCHEMA_VERSION, (d) => d)).toThrow(/leads nowhere/);
    expect(() => registerDocMigration(0, (d) => d)).toThrow(/leads nowhere/);
  });
});

describe('two nodes that became one', () => {
  it('merges a Style and its Cast into one Set, and re-points the wires', () => {
    const graph = {
      nodes: [
        { id: 'style', type: 'core/style', params: { brief: 'nền kem', frame: '9:16' }, bypassed: false, position: { x: 0, y: 0 } },
        { id: 'cast', type: 'core/cast', params: { members: [{ id: 'phone', brief: 'điện thoại', placement: 'over', width: 0, height: 0, source: '' }] }, bypassed: false, position: { x: 1, y: 0 } },
        { id: 'ill', type: 'core/illustrator', params: {}, bypassed: false, position: { x: 2, y: 0 } },
      ],
      edges: [
        { id: 'a', source: 'style', sourcePort: 'style', target: 'cast', targetPort: 'style' },
        { id: 'b', source: 'style', sourcePort: 'style', target: 'ill', targetPort: 'style' },
        { id: 'c', source: 'cast', sourcePort: 'cast', target: 'ill', targetPort: 'cast' },
      ],
    } as Graph;
    const { graph: after, notes } = migrateGraph(structuredClone(graph));
    // The Illustrator became three nodes of its own in the same pass; what this test is about is
    // that the cast joined the style rather than staying a node.
    expect(after.nodes.map((n) => n.type)).toContain('core/set');
    expect(after.nodes.map((n) => n.type)).not.toContain('core/cast');
    // The style's own settings stay, and the cast's members move onto it.
    const set = after.nodes.find((n) => n.type === 'core/set')!;
    expect(set.params).toMatchObject({ brief: 'nền kem', members: [{ id: 'phone' }] });
    // The wire between them is gone; the one that fed the Illustrator now leaves the same node.
    expect(after.edges.every((e) => e.source === 'style' || after.nodes.some((n) => n.id === e.source))).toBe(true);
    expect(after.edges.filter((e) => e.source === 'style').map((e) => e.sourcePort).sort()).toContain('layers');
    expect(notes.some((n) => n.message.includes('core/set'))).toBe(true);
  });

  it('leaves a Style with no Cast alone but for its own name', () => {
    const { graph } = migrateGraph({
      nodes: [{ id: 's', type: 'core/style', params: { brief: 'x' }, bypassed: false, position: { x: 0, y: 0 } }],
      edges: [],
    } as Graph);
    expect(graph.nodes[0]!.type).toBe('core/set');
    expect(graph.nodes[0]!.params).toMatchObject({ brief: 'x', members: [] });
  });
});

describe('a file already at this format', () => {
  it('still has its graph brought forward, because most node changes never touch the format', () => {
    // The bug this holds shut: a workflow saved this morning, opened this afternoon, came back with
    // node types the build no longer had — the doc version matched, so nothing ran.
    const doc = {
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: 'x', name: 'x', category: 'mine',
      graph: { nodes: [{ id: 's', type: 'core/style', params: { brief: 'x' }, bypassed: false, position: { x: 0, y: 0 } }], edges: [] },
    } as unknown as SavedDoc;
    const { doc: after, notes } = migrateDoc(doc);
    expect(after.graph.nodes[0]!.type).toBe('core/set');
    expect(notes.some((n) => n.code === 'DOC_FORMAT'), 'nothing about the format changed').toBe(false);
  });
});

/**
 * The cast and the layers were two payloads for one idea, on two ports of the assembler, which
 * converted one into the other on the way in. One payload now, one port — and a pin is keyed by
 * port name, so a pinned set has to move with it or it emits something nothing reads.
 */
describe('two payloads that became one', () => {
  const at = '2026-09-12T00:00:00.000Z';
  const old = () => ({
    nodes: [
      {
        id: 'set', type: 'core/set', params: {}, bypassed: false, position: { x: 0, y: 0 },
        pinned: { outputs: { style: { name: 's' }, cast: { members: [{ id: 'phone', brief: 'b', placement: 'over', width: 300, height: 600, source: '<div></div>' }] } }, at },
      },
      { id: 'lay', type: 'core/layer', params: {}, bypassed: false, position: { x: 0, y: 0 } },
      { id: 'asm', type: 'core/timeline-assembler', params: {}, bypassed: false, position: { x: 0, y: 0 } },
    ],
    edges: [
      { id: 'a', source: 'set', sourcePort: 'cast', target: 'asm', targetPort: 'cast' },
      { id: 'b', source: 'lay', sourcePort: 'layer', target: 'asm', targetPort: 'layers' },
    ],
  });

  it('re-points every wire at the one port that is left', () => {
    const { graph } = migrateGraph(old() as Graph);
    expect(graph.edges.map((e) => `${e.sourcePort}->${e.targetPort}`)).toEqual(['layers->layers', 'layers->layers']);
  });

  it('moves a pinned cast across, so a pinned set still emits something the assembler reads', () => {
    const { graph } = migrateGraph(old() as Graph);
    const pinned = graph.nodes.find((n) => n.id === 'set')!.pinned!.outputs as Record<string, { layers?: unknown[] }>;
    expect(pinned.cast).toBeUndefined();
    expect(pinned.style).toBeDefined();
    expect(PAYLOAD_SCHEMAS.LayerSheet.safeParse(pinned.layers).success).toBe(true);
    expect(pinned.layers!.layers![0]).toMatchObject({ kind: 'code', id: 'phone', width: 300, startSeconds: 0 });
  });
});
