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

  it('carries the settings across rather than starting the node over', () => {
    const { doc } = migrateDoc(structuredClone(perVendorProviders) as SavedDoc);
    const voice = doc.graph.nodes.find((n) => n.id === 'voice')!;
    expect(voice.params).toMatchObject({ providerId: 'system-tts', settings: { rate: 1.15 } });
    const brain = doc.graph.nodes.find((n) => n.id === 'brain')!;
    expect(brain.params).toMatchObject({ providerId: 'claude-code', settings: { model: 'sonnet' } });
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
  it('becomes the type that replaced it, and says so', () => {
    const { notes, graph } = migrateGraph(structuredClone(retiredNodes.graph) as Graph);
    const art = graph.nodes.find((n) => n.id === 'art')!;
    expect(art.type).toBe('core/illustrator');
    expect(notes.find((n) => n.code === 'NODE_REPLACED')?.message).toContain('core/art-director');
    // Its old settings mean nothing to the new node, so they go and the person is told which.
    const lost = notes.find((n) => n.code === 'PARAMS_DROPPED');
    expect(lost?.nodeId).toBe('art');
    expect(lost?.message).toContain('stages');
    expect(hasBlockingIssues(validateGraph({ nodes: [art], edges: [] }).filter((i) => i.code === 'NODE_PARAMS_INVALID'))).toBe(false);
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
