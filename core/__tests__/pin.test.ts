import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Executor } from '../engine/executor';
import { pinNode, unpinNode, type Graph } from '../engine/graph';
import { _resetNodeRegistry, registerNodeType, type AnyNodeDefinition, type NodeDefinition } from '../nodes/definition';
import { makeFakeServices } from '@/contracts/__tests__/fakes';
import { GraphSchema } from '../templates/registry';
import { _resetPortTypes, registerPortType } from '../types/ports';

/**
 * Pinning (CORE_CONTRACTS §1.4): a node's outputs frozen into the graph, handed back instead of run.
 *
 * A workflow used to keep only instructions. The look of a film was a sentence, derived again on
 * every run, so two videos from one workflow were two near-misses rather than one house style — and
 * the expensive half of the pipeline was paid for twice. A pin is how a result you approved becomes
 * part of the workflow. It is deliberately blunt: a pinned node ignores its inputs, ignores a forced
 * run, and does not ask the model anything.
 */

const Params = z.object({ value: z.string() });
let ran = 0;
const source: NodeDefinition<typeof Params> = {
  type: 'test/source',
  version: 1,
  kind: 'source',
  inputs: [],
  outputs: [{ name: 'out', type: 'SourceRef' }],
  paramsSchema: Params,
  defaultParams: { value: '' },
  run: async ({ params }) => { ran++; return { out: { value: params.value } }; },
};
const NoParams = z.object({});
let downstream = 0;
const sink: NodeDefinition<typeof NoParams> = {
  type: 'test/sink',
  version: 1,
  kind: 'process',
  inputs: [{ name: 'in', type: 'SourceRef' }],
  outputs: [{ name: 'out', type: 'SourceRef' }],
  paramsSchema: NoParams,
  defaultParams: {},
  run: async ({ inputs }) => { downstream++; return { out: inputs.in!.payload }; },
};

const graph = (): Graph => ({
  nodes: [
    { id: 'a', type: 'test/source', params: { value: 'first' }, bypassed: false, position: { x: 0, y: 0 } },
    { id: 'b', type: 'test/sink', params: {}, bypassed: false, position: { x: 1, y: 0 } },
  ],
  edges: [{ id: 'e1', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' }],
});
const valueOf = (ex: Executor, id: string) => (ex.runtime(id).outputs.out?.payload as { value: string } | undefined)?.value;

beforeEach(() => {
  _resetNodeRegistry();
  // The wire's own schema is what a stale pin is checked against; the core registers none itself.
  _resetPortTypes();
  registerPortType('SourceRef', { labelKey: 'port.sourceRef', schema: z.object({ value: z.string() }) });
  registerNodeType(source as unknown as AnyNodeDefinition);
  registerNodeType(sink as unknown as AnyNodeDefinition);
  ran = 0;
  downstream = 0;
});

describe('a pinned node', () => {
  it('hands back what was frozen and does not run, even when its parameters change', async () => {
    const first = new Executor(graph(), makeFakeServices());
    await first.run();
    expect(ran).toBe(1);

    // What the canvas does: take the outputs of the run you looked at, and keep them.
    const pinnedGraph = pinNode(first.getGraph(), 'a', first.runtime('a').outputs, '2026-09-12T09:00:00.000Z');
    const g = { ...pinnedGraph, nodes: pinnedGraph.nodes.map((n) => (n.id === 'a' ? { ...n, params: { value: 'rewritten' } } : n)) };

    ran = 0;
    const ex = new Executor(g, makeFakeServices());
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    expect(ran, 'the pinned node ran anyway').toBe(0);
    expect(valueOf(ex, 'a'), 'the new parameter won over the pin').toBe('first');
    expect(valueOf(ex, 'b')).toBe('first');
  });

  it('is not thawed by a forced run, which is the point of pinning rather than caching', async () => {
    const first = new Executor(graph(), makeFakeServices());
    await first.run();
    const g = pinNode(first.getGraph(), 'a', first.runtime('a').outputs, '2026-09-12T09:00:00.000Z');
    ran = 0;
    const ex = new Executor(g, makeFakeServices());
    await ex.run({ force: true });
    expect(ran).toBe(0);
    expect(valueOf(ex, 'a')).toBe('first');
  });

  it('gives downstream the same packet twice, so the rest of the film is reused rather than redone', async () => {
    const first = new Executor(graph(), makeFakeServices());
    await first.run();
    const g = pinNode(first.getGraph(), 'a', first.runtime('a').outputs, '2026-09-12T09:00:00.000Z');
    const ex = new Executor(g, makeFakeServices());
    await ex.run();
    const hash = ex.runtime('a').outputs.out!.contentHash;
    downstream = 0;
    await ex.run();
    expect(ex.runtime('a').outputs.out!.contentHash, 'the frozen payload hashed differently on a second pass').toBe(hash);
    expect(downstream, 'the node after it ran again for no reason').toBe(0);
  });

  it('runs again the moment it is unpinned', async () => {
    const first = new Executor(graph(), makeFakeServices());
    await first.run();
    const g = unpinNode(pinNode(first.getGraph(), 'a', first.runtime('a').outputs, '2026-09-12T09:00:00.000Z'), 'a');
    expect(g.nodes.find((n) => n.id === 'a')!.pinned).toBeUndefined();
    ran = 0;
    const ex = new Executor(g, makeFakeServices());
    await ex.run();
    expect(ran).toBe(1);
  });

  it('says so rather than feeding the film a shape this build cannot read', async () => {
    const g = graph();
    g.nodes[0] = { ...g.nodes[0]!, pinned: { outputs: { out: { nonsense: true } }, at: '2026-09-12T09:00:00.000Z' } };
    const ex = new Executor(g, makeFakeServices());
    await ex.run();
    expect(ex.runtime('a').state).toBe('error');
    expect(ex.runtime('a').error?.fix).toContain('unpin');
    expect(ex.runtime('b').state).toBe('blocked');
  });
});

describe('what a pin is made of', () => {
  it('is nothing at all when the node produced nothing to keep', async () => {
    const g = graph();
    expect(pinNode(g, 'a', {}, 'now')).toBe(g);
    expect(pinNode(g, 'a', { out: { payload: undefined } }, 'now')).toBe(g);
  });

  it('goes to disk with the workflow and comes back whole', async () => {
    const first = new Executor(graph(), makeFakeServices());
    await first.run();
    const g = pinNode(first.getGraph(), 'a', first.runtime('a').outputs, '2026-09-12T09:00:00.000Z');
    const round = GraphSchema.parse(JSON.parse(JSON.stringify(g)));
    expect(round.nodes.find((n) => n.id === 'a')!.pinned).toEqual({ outputs: { out: { value: 'first' } }, at: '2026-09-12T09:00:00.000Z' });
  });
});
