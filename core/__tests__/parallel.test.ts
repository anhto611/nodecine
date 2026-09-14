import { beforeEach, describe, expect, it } from 'vitest';
import { Executor } from '../engine/executor';
import type { Graph } from '../engine/graph';
import { _resetNodeRegistry } from '../nodes/definition';
import { _resetPortTypes } from '../types/ports';
import { registerTestKit, testServices } from './kit';

/**
 * Nodes that do not wait on each other run at the same time.
 *
 * The executor walked the topological order one node at a time, so a voice and a drawing that share
 * nothing queued behind each other and a film took the sum of its steps instead of its longest path.
 */

const at = { x: 0, y: 0 };
/** Two sources, a voice each, joined, shown: the voices share nothing until the join. */
const twoBranches = (): Graph => ({
  nodes: [
    { id: 'a', type: 'test/source', params: { value: 'a' }, bypassed: false, position: at },
    { id: 'b', type: 'test/source', params: { value: 'b' }, bypassed: false, position: at },
    { id: 'va', type: 'test/voice', params: { speed: 1 }, bypassed: false, position: at },
    { id: 'vb', type: 'test/voice', params: { speed: 1 }, bypassed: false, position: at },
    { id: 'join', type: 'test/join', params: { fps: 30, wantsExtra: false }, bypassed: false, position: at },
    { id: 'sink', type: 'test/sink', params: {}, bypassed: false, position: at },
  ],
  edges: [
    { id: 'e1', source: 'a', sourcePort: 'out', target: 'va', targetPort: 'in' },
    { id: 'e2', source: 'b', sourcePort: 'out', target: 'vb', targetPort: 'in' },
    { id: 'e3', source: 'va', sourcePort: 'out', target: 'join', targetPort: 'in' },
    { id: 'e4', source: 'vb', sourcePort: 'out', target: 'join', targetPort: 'extra' },
    { id: 'e5', source: 'join', sourcePort: 'out', target: 'sink', targetPort: 'in' },
  ],
});

/** Services that record the most voices ever in flight at once. */
function measured(ms: number) {
  const services = testServices();
  services.delay('voice', ms);
  let now = 0;
  let most = 0;
  const invoke = services.invoke.bind(services);
  services.invoke = async <T,>(id: string, args: unknown[]): Promise<T> => {
    if (id !== 'voice') return invoke<T>(id, args);
    most = Math.max(most, ++now);
    try { return await invoke<T>(id, args); } finally { now--; }
  };
  return { services, most: () => most };
}

beforeEach(() => {
  _resetNodeRegistry();
  _resetPortTypes();
  registerTestKit();
});

describe('a run', () => {
  it('runs branches that share nothing at the same time, and what joins them after both', async () => {
    const { services, most } = measured(20);
    const ex = new Executor(twoBranches(), services);
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    expect(most()).toBe(2);
    // The join read both voices, so it cannot have started before either finished.
    expect(ex.runtime('join').outputs.out!.payload).toEqual({ text: 'a@1+b@1' });
  });

  it('runs one at a time when told to', async () => {
    const { services, most } = measured(5);
    await new Executor(twoBranches(), services, {}, undefined, { maxParallel: 1 }).run();
    expect(most()).toBe(1);
  });

  it('counts every node that runs as one step, whatever order they start in', async () => {
    const steps: number[] = [];
    let total = 0;
    const ex = new Executor(twoBranches(), testServices(), { onRunStart: (i) => { total = i.stepTotal; }, onStep: (i) => steps.push(i.step) });
    await ex.run();
    expect(total).toBe(6);
    expect(steps).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('on cancel, stops every node in flight and starts nothing after', async () => {
    const services = testServices();
    services.delay('voice', 30);
    const ex = new Executor(twoBranches(), services);
    const running = ex.run();
    await new Promise((r) => setTimeout(r, 5));
    ex.cancel();
    services.fail('voice', Object.assign(new Error('aborted'), { code: 'RUN_CANCELLED' }));
    const { ok } = await running;
    expect(ok).toBe(false);
    expect(ex.runtime('va').state).toBe('cancelled');
    expect(ex.runtime('vb').state).toBe('cancelled');
    expect(ex.runtime('join').state).toBe('blocked');
    expect(ex.runtime('join').blockedBy?.code).toBe('RUN_CANCELLED');
    expect(services.calls.some((c) => c.name === 'show')).toBe(false);
  });

  it('lets one branch fail and the other finish, and blocks only what waited on the failure', async () => {
    const services = testServices();
    const graph = twoBranches();
    // A third branch, alone to the sink of its own.
    graph.nodes.push({ id: 'c', type: 'test/source', params: { value: 'c' }, bypassed: false, position: at }, { id: 'sc', type: 'test/sink', params: {}, bypassed: false, position: at });
    graph.edges.push({ id: 'e6', source: 'c', sourcePort: 'out', target: 'sc', targetPort: 'in' });
    graph.nodes.find((n) => n.id === 'va')!.params.speed = 0.5;
    const ex = new Executor(graph, services);
    const invoke = services.invoke.bind(services);
    services.invoke = async <T,>(id: string, args: unknown[]): Promise<T> => {
      if (id === 'voice' && args[1] === 0.5) throw Object.assign(new Error('say exited 1'), { code: 'PROVIDER_PROCESS_FAILED' });
      return invoke<T>(id, args);
    };
    const { ok } = await ex.run();
    expect(ok).toBe(false);
    expect(ex.runtime('va').state).toBe('error');
    expect(ex.runtime('vb').state).toBe('success');
    expect(ex.runtime('join').state).toBe('blocked');
    expect(ex.runtime('sc').state).toBe('success');
  });
});
