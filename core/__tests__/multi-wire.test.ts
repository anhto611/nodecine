import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Executor } from '../engine/executor';
import { validateGraph, type Graph } from '../engine/graph';
import { _resetNodeRegistry, registerNodeType, type AnyNodeDefinition, type NodeDefinition } from '../nodes/definition';
import { blocks, stage } from '@/nodes';
import { makeFakeServices } from './fakes';

/**
 * A `multiple` port takes any number of wires and hands the packets to run() as a list, in edge
 * order. This is how the AI Director receives its block catalogue: one Blocks node per wire.
 */
const Params = z.object({});
const collector: NodeDefinition<typeof Params> = {
  type: 'test/collector',
  version: 1,
  namespace: 'test',
  kind: 'process',
  inputs: [
    { name: 'stage', type: 'StageDef' },
    { name: 'blocks', type: 'BlockSet', multiple: true },
  ],
  outputs: [{ name: 'stage', type: 'StageDef' }],
  paramsSchema: Params,
  defaultParams: {},
  run: async ({ inputs, lists }) => {
    const ids = (lists.blocks ?? []).flatMap((p) => (p.payload as { blocks: { id: string }[] }).blocks.map((b) => b.id));
    const st = inputs.stage!.payload as { name: string };
    return { stage: { ...(inputs.stage!.payload as object), name: `${st.name}:${ids.join('+')}` } };
  },
};

function blockNode(id: string, x: number) {
  return { id, type: 'core/blocks', params: { blocks: [{ ...blocks.defaultParams.blocks[0]!, id }] }, bypassed: false, position: { x, y: 0 } };
}

function graph(): Graph {
  return {
    nodes: [
      { id: 'st', type: 'core/stage', params: stage.defaultParams, bypassed: false, position: { x: 0, y: 0 } },
      blockNode('b1', 0),
      blockNode('b2', 1),
      blockNode('b3', 2),
      { id: 'col', type: 'test/collector', params: {}, bypassed: false, position: { x: 0, y: 0 } },
    ],
    edges: [
      { id: 'e0', source: 'st', sourcePort: 'stage', target: 'col', targetPort: 'stage' },
      { id: 'e1', source: 'b1', sourcePort: 'blocks', target: 'col', targetPort: 'blocks' },
      { id: 'e2', source: 'b2', sourcePort: 'blocks', target: 'col', targetPort: 'blocks' },
      { id: 'e3', source: 'b3', sourcePort: 'blocks', target: 'col', targetPort: 'blocks' },
    ],
  };
}

describe('multiple-wire ports', () => {
  beforeEach(() => {
    _resetNodeRegistry();
    registerNodeType(stage as unknown as AnyNodeDefinition);
    registerNodeType(blocks as unknown as AnyNodeDefinition);
    registerNodeType(collector as unknown as AnyNodeDefinition);
  });

  it('validates three wires into one multiple port, and rejects them on a single port', () => {
    const errors = (g: Graph) => validateGraph(g).filter((i) => i.severity === 'error');
    expect(errors(graph())).toEqual([]);
    const g = graph();
    g.edges.push({ id: 'e4', source: 'b1', sourcePort: 'blocks', target: 'col', targetPort: 'stage' });
    expect(errors(g).some((i) => i.port === 'stage' && /more than one/.test(i.message))).toBe(true);
  });

  it('delivers the packets as a list in edge order', async () => {
    const ex = new Executor(graph(), makeFakeServices());
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    const out = ex.runtime('col').outputs.stage!.payload as { name: string };
    expect(out.name).toBe('Dark:b1+b2+b3');
  });

  it('is satisfied by one wire, and is unwired with none', async () => {
    const g = graph();
    g.edges = g.edges.filter((e) => e.id !== 'e2' && e.id !== 'e3');
    const ex = new Executor(g, makeFakeServices());
    await ex.run();
    expect((ex.runtime('col').outputs.stage!.payload as { name: string }).name).toBe('Dark:b1');

    g.edges = g.edges.filter((e) => e.targetPort !== 'blocks');
    const issue = validateGraph(g).find((i) => i.port === 'blocks');
    expect(issue?.code).toBe('GRAPH_PORT_UNCONNECTED');
    expect(issue?.severity).toBe('error');
  });

  it('re-runs when a wire is added and reuses when the list is unchanged', async () => {
    const g = graph();
    g.edges = g.edges.filter((e) => e.id !== 'e3');
    const ex = new Executor(g, makeFakeServices());
    await ex.run();
    await ex.run();
    expect(ex.runtime('col').reused).toBe(true);

    g.edges.push({ id: 'e3', source: 'b3', sourcePort: 'blocks', target: 'col', targetPort: 'blocks' });
    ex.setGraph(g);
    await ex.run();
    expect(ex.runtime('col').reused).toBe(false);
    expect((ex.runtime('col').outputs.stage!.payload as { name: string }).name).toBe('Dark:b1+b2+b3');
  });

  it('blocks on a bypassed block upstream and names it', async () => {
    const g = graph();
    g.nodes.find((n) => n.id === 'b2')!.bypassed = true;
    const ex = new Executor(g, makeFakeServices());
    await ex.run();
    const rt = ex.runtime('col');
    expect(rt.state).toBe('blocked');
    expect(rt.blockedBy?.nodeId).toBe('b2');
  });
});
