import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Executor } from '../engine/executor';
import { validateGraph, type Graph } from '../engine/graph';
import { _resetNodeRegistry, registerNodeType, type AnyNodeDefinition, type NodeDefinition } from '../nodes/definition';
import { TEXT, testServices } from './kit';

/**
 * A `multiple` port takes any number of wires and hands the packets to run() as a list, in edge
 * order. No core node currently uses one, but the engine keeps the
 * feature for nodes that gather many of a kind.
 */
const Params = z.object({ value: z.string() });
const source: NodeDefinition<typeof Params> = {
  type: 'test/source',
  version: 1,
  kind: 'source',
  inputs: [],
  outputs: [{ name: 'out', type: TEXT }],
  paramsSchema: Params,
  defaultParams: { value: '' },
  run: async ({ params }) => ({ out: { value: params.value } }),
};
const NoParams = z.object({});
const collector: NodeDefinition<typeof NoParams> = {
  type: 'test/collector',
  version: 1,
  kind: 'process',
  inputs: [
    { name: 'head', type: TEXT },
    { name: 'parts', type: TEXT, multiple: true },
  ],
  outputs: [{ name: 'out', type: TEXT }],
  paramsSchema: NoParams,
  defaultParams: {},
  run: async ({ inputs, lists }) => {
    const ids = (lists.parts ?? []).map((p) => (p.payload as { value: string }).value);
    const head = inputs.head!.payload as { value: string };
    return { out: { value: `${head.value}:${ids.join('+')}` } };
  },
};

const src = (id: string, x: number) => ({ id, type: 'test/source', params: { value: id }, bypassed: false, position: { x, y: 0 } });

function graph(): Graph {
  return {
    nodes: [src('head', 0), src('b1', 0), src('b2', 1), src('b3', 2), { id: 'col', type: 'test/collector', params: {}, bypassed: false, position: { x: 0, y: 0 } }],
    edges: [
      { id: 'e0', source: 'head', sourcePort: 'out', target: 'col', targetPort: 'head' },
      { id: 'e1', source: 'b1', sourcePort: 'out', target: 'col', targetPort: 'parts' },
      { id: 'e2', source: 'b2', sourcePort: 'out', target: 'col', targetPort: 'parts' },
      { id: 'e3', source: 'b3', sourcePort: 'out', target: 'col', targetPort: 'parts' },
    ],
  };
}

const valueOut = (ex: Executor) => (ex.runtime('col').outputs.out!.payload as { value: string }).value;

describe('multiple-wire ports', () => {
  beforeEach(() => {
    _resetNodeRegistry();
    registerNodeType(source as unknown as AnyNodeDefinition);
    registerNodeType(collector as unknown as AnyNodeDefinition);
  });

  it('validates three wires into one multiple port, and rejects them on a single port', () => {
    const errors = (g: Graph) => validateGraph(g).filter((i) => i.severity === 'error');
    expect(errors(graph())).toEqual([]);
    const g = graph();
    g.edges.push({ id: 'e4', source: 'b1', sourcePort: 'out', target: 'col', targetPort: 'head' });
    expect(errors(g).some((i) => i.port === 'head' && /more than one/.test(i.message))).toBe(true);
  });

  it('delivers the packets as a list in edge order', async () => {
    const ex = new Executor(graph(), testServices());
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    expect(valueOut(ex)).toBe('head:b1+b2+b3');
  });

  it('is satisfied by one wire, and is unwired with none', async () => {
    const g = graph();
    g.edges = g.edges.filter((e) => e.id !== 'e2' && e.id !== 'e3');
    const ex = new Executor(g, testServices());
    await ex.run();
    expect(valueOut(ex)).toBe('head:b1');

    g.edges = g.edges.filter((e) => e.targetPort !== 'parts');
    const issue = validateGraph(g).find((i) => i.port === 'parts');
    expect(issue?.code).toBe('GRAPH_PORT_UNCONNECTED');
    // Nothing downstream of this collector ends at a sink, so its empty port is said, not obeyed
    // (§1.4): a node that cannot reach the film cannot stop the run.
    expect(issue?.severity).toBe('warning');
  });

  it('re-runs when a wire is added and reuses when the list is unchanged', async () => {
    const g = graph();
    g.edges = g.edges.filter((e) => e.id !== 'e3');
    const ex = new Executor(g, testServices());
    await ex.run();
    await ex.run();
    expect(ex.runtime('col').reused).toBe(true);

    g.edges.push({ id: 'e3', source: 'b3', sourcePort: 'out', target: 'col', targetPort: 'parts' });
    ex.setGraph(g);
    await ex.run();
    expect(ex.runtime('col').reused).toBe(false);
    expect(valueOut(ex)).toBe('head:b1+b2+b3');
  });

  it('blocks on a bypassed part upstream and names it', async () => {
    const g = graph();
    g.nodes.find((n) => n.id === 'b2')!.bypassed = true;
    const ex = new Executor(g, testServices());
    await ex.run();
    const rt = ex.runtime('col');
    expect(rt.state).toBe('blocked');
    expect(rt.blockedBy?.nodeId).toBe('b2');
  });
});

/**
 * A port that a node leaves silent. Not every output is produced on every run — the Illustrator
 * emits a spanning layer only when the film has one — and a wire from such a port into an optional
 * input must leave the consumer alone rather than block it.
 */
describe('a wire from a port the upstream left silent', () => {
  const sometimes: NodeDefinition<typeof Params> = {
    type: 'test/sometimes',
    version: 1,
    kind: 'source',
    inputs: [],
    outputs: [{ name: 'out', type: TEXT }, { name: 'extra', type: TEXT }],
    paramsSchema: Params,
    defaultParams: { value: '' },
    run: async ({ params }) => (params.value ? { out: { value: params.value }, extra: { value: 'extra' } } : { out: { value: 'plain' } }),
  };
  const taker: NodeDefinition<typeof NoParams> = {
    type: 'test/taker',
    version: 1,
    kind: 'process',
    inputs: [
      { name: 'head', type: TEXT },
      { name: 'parts', type: TEXT, required: false, multiple: true },
      { name: 'one', type: TEXT, required: false },
    ],
    outputs: [{ name: 'out', type: TEXT }],
    paramsSchema: NoParams,
    defaultParams: {},
    run: async ({ inputs, lists }) => ({ out: { value: `${(inputs.head!.payload as { value: string }).value}:${(lists.parts ?? []).length}:${inputs.one ? 'one' : 'none'}` } }),
  };

  const g = (value: string): Graph => ({
    nodes: [
      { id: 'src', type: 'test/sometimes', params: { value }, bypassed: false, position: { x: 0, y: 0 } },
      { id: 'take', type: 'test/taker', params: {}, bypassed: false, position: { x: 0, y: 0 } },
    ],
    edges: [
      { id: 'a', source: 'src', sourcePort: 'out', target: 'take', targetPort: 'head' },
      { id: 'b', source: 'src', sourcePort: 'extra', target: 'take', targetPort: 'parts' },
      { id: 'c', source: 'src', sourcePort: 'extra', target: 'take', targetPort: 'one' },
    ],
  });

  beforeEach(() => {
    _resetNodeRegistry();
    registerNodeType(sometimes as unknown as AnyNodeDefinition);
    registerNodeType(taker as unknown as AnyNodeDefinition);
  });

  it('runs the consumer with that input simply absent', async () => {
    const ex = new Executor(g(''), testServices());
    expect((await ex.run()).ok).toBe(true);
    expect((ex.runtime('take').outputs.out!.payload as { value: string }).value).toBe('plain:0:none');
  });

  it('carries the packet when the upstream does produce one', async () => {
    const ex = new Executor(g('yes'), testServices());
    expect((await ex.run()).ok).toBe(true);
    expect((ex.runtime('take').outputs.out!.payload as { value: string }).value).toBe('yes:1:one');
  });
});
