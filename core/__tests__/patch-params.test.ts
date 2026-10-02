import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Executor } from '../engine/executor';
import type { Graph } from '../engine/graph';
import { _resetNodeRegistry, registerNodeType, type AnyNodeDefinition, type NodeDefinition } from '../nodes/definition';
import { TEXT, testServices } from './kit';

/**
 * A node may change its own parameters while it runs (RunContext.patchParams): the patch goes
 * into the graph and out through a hook, and the result is signed over the patched parameters so
 * the next run reuses it instead of doing the work twice.
 */
const Params = z.object({ seen: z.array(z.string()).default([]) });
let runs = 0;
const learner: NodeDefinition<typeof Params> = {
  type: 'test/learner',
  version: 1,
  kind: 'source',
  inputs: [],
  outputs: [{ name: 'out', type: TEXT }],
  paramsSchema: Params,
  defaultParams: { seen: [] },
  run: async ({ params, patchParams }) => {
    runs++;
    if (!params.seen.includes('x')) patchParams({ seen: [...params.seen, 'x'] });
    return { out: { value: 'v' } };
  },
};

const graph = (): Graph => ({ nodes: [{ id: 'l', type: 'test/learner', params: { seen: [] }, bypassed: false, position: { x: 0, y: 0 } }], edges: [] });

describe('a node that patches its own params', () => {
  beforeEach(() => {
    _resetNodeRegistry();
    registerNodeType(learner as unknown as AnyNodeDefinition);
    runs = 0;
  });

  it("lands the patch in the executor's graph and the hook, and is reused on the next run", async () => {
    const patches: unknown[] = [];
    const ex = new Executor(graph(), testServices(), { onParamsPatch: (id, p) => patches.push([id, p]) });
    await ex.run();
    expect(patches).toEqual([['l', { seen: ['x'] }]]);
    expect(ex.getGraph().nodes[0]!.params).toEqual({ seen: ['x'] });
    // The client mirrors the patch and sends the graph back; the signature already covers it.
    ex.setGraph(ex.getGraph());
    await ex.run();
    expect(runs).toBe(1);
    expect(ex.runtime('l').reused).toBe(true);
  });
});
