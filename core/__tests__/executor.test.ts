import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Executor } from '../engine/executor';
import { validateGraph, GraphInvalidError, type Graph } from '../engine/graph';
import { _resetNodeRegistry, registerNodeType, type AnyNodeDefinition } from '../nodes/definition';
import { _resetPortTypes } from '../types/ports';
import { canTransition } from '../engine/state';
import { NodeError } from '../errors';
import { pipeline, registerTestKit, testServices } from './kit';

function setup() {
  _resetNodeRegistry();
  _resetPortTypes();
  registerTestKit();
  const services = testServices();
  const graph = pipeline();
  const states: string[] = [];
  const executor = new Executor(graph, services, { onStateChange: (id, rt) => states.push(`${id}:${rt.state}`) });
  return { services, graph, executor, states };
}

const count = (services: ReturnType<typeof testServices>, name: string) => services.calls.filter((c) => c.name === name).length;
const failure = (code: string, message: string, fix?: string) => Object.assign(new Error(message), { code, ...(fix ? { fix } : {}) });

describe('graph validation', () => {
  it('a wired pipeline has no blocking issues', () => {
    const { graph } = setup();
    expect(validateGraph(graph).filter((i) => i.severity === 'error')).toEqual([]);
  });
  it('an unconnected required input is said on its node', () => {
    const { graph } = setup();
    graph.edges = graph.edges.filter((e) => e.id !== 'e1');
    expect(validateGraph(graph).some((i) => i.code === 'GRAPH_PORT_UNCONNECTED' && i.nodeId === 'voice')).toBe(true);
  });
  it('detects cycles and reports the offending edges', () => {
    const { graph } = setup();
    graph.edges.push({ id: 'cyc', source: 'join', sourcePort: 'out', target: 'source', targetPort: 'x' });
    expect(validateGraph(graph).find((i) => i.code === 'GRAPH_CYCLE')?.edgeIds).toContain('cyc');
  });
  it('a graph with no sink only warns', () => {
    const { graph } = setup();
    graph.nodes = graph.nodes.filter((n) => n.id !== 'sink' && n.id !== 'export');
    graph.edges = graph.edges.filter((e) => !['e3', 'e4'].includes(e.id));
    const issues = validateGraph(graph);
    expect(issues.find((i) => i.code === 'GRAPH_NO_SINK')?.severity).toBe('warning');
    expect(issues.some((i) => i.severity === 'error')).toBe(false);
  });
  it('a node\'s own check on its parameters is continuous', () => {
    setup();
    const g: Graph = { nodes: [{ id: 'in', type: 'test/source', params: { value: '  ' }, bypassed: false, position: { x: 0, y: 0 } }], edges: [] };
    expect(validateGraph(g).some((i) => i.code === 'INPUT_EMPTY')).toBe(true);
  });
});

describe('a run', () => {
  it('runs every node in the flow and leaves the on-demand node alone', async () => {
    const { executor, services } = setup();
    const { ok } = await executor.run();
    expect(ok).toBe(true);
    for (const id of ['source', 'voice', 'join', 'sink']) expect(executor.runtime(id).state).toBe('success');
    // Untouched rather than skipped: a Run never reaches an on-demand node at all.
    expect(executor.runtime('export').state).toBe('idle');
    expect(executor.runtime('join').outputs.out!.payload).toEqual({ text: 'hello@1' });
    expect(count(services, 'export')).toBe(0);
  });

  it('keeps what an on-demand node produced when the canvas pushes a graph', async () => {
    // Moving a node is a graph change like any other, and it reaches the executor as one. An
    // on-demand node is bypassed by type — it never joins a Run — so re-applying that flag on every
    // push used to wipe the result of its own button: render an export, drag the node, picture gone.
    const { executor, graph } = setup();
    await executor.run();
    await executor.runNode('export');
    expect(executor.runtime('export').state).toBe('success');
    const before = executor.runtime('export').result;
    executor.setGraph({ ...graph, nodes: graph.nodes.map((n) => (n.id === 'export' ? { ...n, position: { x: 120, y: 40 } } : n)) });
    expect(executor.runtime('export').state).toBe('success');
    expect(executor.runtime('export').result).toBe(before);
  });

  it('reuses everything on a second run; a changed parameter re-runs only its node and what follows', async () => {
    const { executor, services, graph } = setup();
    await executor.run();
    expect(count(services, 'voice')).toBe(1);

    await executor.run();
    for (const id of ['source', 'voice', 'join']) expect(executor.runtime(id).reused).toBe(true);
    expect(count(services, 'voice')).toBe(1);
    // A sink has no outputs to reuse, so it always runs.
    expect(count(services, 'show')).toBe(2);

    graph.nodes.find((n) => n.id === 'voice')!.params.speed = 1.15;
    executor.invalidate('voice');
    expect(executor.runtime('join').state).toBe('stale');
    await executor.run();
    expect(count(services, 'voice')).toBe(2);
    expect(executor.runtime('source').reused).toBe(true);
    expect(executor.runtime('voice').reused).toBe(false);
    expect(executor.runtime('join').reused).toBe(false);
    expect(executor.runtime('join').outputs.out!.payload).toEqual({ text: 'hello@1.15' });
  });

  it('collects what a node warns about on the node, and clears it once the cause is gone', async () => {
    const { executor, graph } = setup();
    graph.nodes.find((n) => n.id === 'join')!.params.wantsExtra = true;
    executor.setGraph(graph);
    const { ok } = await executor.run();
    // Degraded, not failed: the node still produced its result.
    expect(ok).toBe(true);
    expect(executor.runtime('join').state).toBe('success');
    expect(executor.runtime('join').warnings?.[0]?.code).toBe('EXTRA_NOT_CONNECTED');

    graph.nodes.push({ id: 'second', type: 'test/source', params: { value: 'two' }, bypassed: false, position: { x: 0, y: 0 } });
    graph.edges.push({ id: 'e5', source: 'second', sourcePort: 'out', target: 'join', targetPort: 'extra' });
    executor.setGraph(graph);
    await executor.run();
    expect(executor.runtime('join').warnings).toBeUndefined();
    expect(executor.runtime('join').outputs.out!.payload).toEqual({ text: 'hello@1+two' });
  });
});

describe('a part a node needs that is not ready', () => {
  const partGraph = (ready: boolean): Graph => ({
    nodes: [
      { id: 'source', type: 'test/source', params: { value: 'x' }, bypassed: false, position: { x: 0, y: 0 } },
      { id: 'part', type: 'test/part', params: { ready }, bypassed: false, position: { x: 0, y: 0 } },
      { id: 'use', type: 'test/uses-part', params: {}, bypassed: false, position: { x: 0, y: 0 } },
    ],
    edges: [
      { id: 'a', source: 'source', sourcePort: 'out', target: 'use', targetPort: 'in' },
      { id: 'b', source: 'part', sourcePort: 'part', target: 'use', targetPort: 'part' },
    ],
  });

  it('blocks the node by capability, with the reason and the remedy the part gave', async () => {
    const { services } = setup();
    const executor = new Executor(partGraph(false), services);
    await executor.run();
    expect(executor.runtime('use').state).toBe('blocked');
    // The part named no code of its own, so the core's own fallback is used — never a video one.
    expect(executor.runtime('use').blockedBy).toMatchObject({ kind: 'capability', code: 'NODE_NOT_READY', message: 'no renderer', fix: 'install one' });
  });

  it('runs once the part is ready', async () => {
    const { services } = setup();
    const executor = new Executor(partGraph(true), services);
    await executor.run();
    expect(executor.runtime('use').state).toBe('success');
  });

  it('a failure carries its code and remedy to the node, and every node behind it names the original cause', async () => {
    const { executor, services } = setup();
    services.fail('voice', failure('PROVIDER_NOT_INSTALLED', 'ffmpeg not found', 'brew install ffmpeg'));
    const { ok } = await executor.run();
    expect(ok).toBe(false);
    expect(executor.runtime('voice').error).toMatchObject({ code: 'PROVIDER_NOT_INSTALLED', fix: 'brew install ffmpeg' });
    // Two steps from the failure, and still naming it rather than an unwired port.
    expect(executor.runtime('sink').blockedBy).toMatchObject({ kind: 'upstream', code: 'PROVIDER_NOT_INSTALLED', fix: 'brew install ffmpeg' });
    expect(executor.runtime('join').blockedBy).toMatchObject({ nodeId: 'voice' });
  });

  it('the world changing between runs is caught on the next run of the node that asks', async () => {
    const { executor, services, graph } = setup();
    await executor.run();
    services.fail('voice', failure('PROVIDER_NOT_INSTALLED', 'ffmpeg not found'));
    // A reused node asks nothing, which is the point of the cache; the node has to run to find out.
    graph.nodes.find((n) => n.id === 'voice')!.params.speed = 1.2;
    executor.invalidate('voice');
    await executor.run();
    expect(executor.runtime('voice').error?.code).toBe('PROVIDER_NOT_INSTALLED');
  });
});

describe('on-demand and single-node runs', () => {
  it('runs only the on-demand node, using the packets already on its inputs', async () => {
    const { executor, services } = setup();
    await executor.run();
    const before = services.calls.length;
    expect(await executor.runNode('export')).toBe('success');
    expect(executor.runtime('export').result).toMatchObject({ fileName: 'film.mp4', bytes: 4800 });
    expect(services.calls.slice(before).map((c) => c.name)).toEqual(['export']);
  });
  it('is refused before any run, naming the missing port', async () => {
    const { executor } = setup();
    await expect(executor.runNode('export')).rejects.toThrow(/has no packet/);
  });
  it('stays out of a Run whatever its bypass flag says', async () => {
    // The flag is a property of the type here, not a switch a person flips, and honouring it let a
    // saved graph put a render at the end of every Run with the player waiting behind it.
    const { executor, services } = setup();
    executor.setBypassed('export', false);
    await executor.run();
    expect(executor.runtime('export').state).not.toBe('success');
    expect(count(services, 'export')).toBe(0);
  });
  it('is not counted among the steps of a Run, so the progress reads true', async () => {
    const { graph, services } = setup();
    let stepTotal = -1;
    const executor = new Executor(graph, services, { onRunStart: (i) => { stepTotal = i.stepTotal; } });
    await executor.run();
    expect(stepTotal).toBe(4);
  });
  it('a failure on its own button says so on that node', async () => {
    const { executor, services } = setup();
    await executor.run();
    services.fail('export', failure('ENGINE_NOT_READY', 'render is only available on the server'));
    await expect(executor.runNode('export')).resolves.toBe('error');
    expect(executor.runtime('export').error?.code).toBe('ENGINE_NOT_READY');
  });
});

describe('errors and cancellation', () => {
  it('a node error blocks downstream, keeps earlier results, and a retry fixes it', async () => {
    const { executor, services } = setup();
    services.fail('voice', failure('PROVIDER_PROCESS_FAILED', 'say exited 1'));
    const { ok } = await executor.run();
    expect(ok).toBe(false);
    expect(executor.runtime('voice').error?.code).toBe('PROVIDER_PROCESS_FAILED');
    expect(executor.runtime('join').state).toBe('blocked');
    expect(executor.runtime('source').state).toBe('success');
    services.fail('voice', null);
    await executor.runNode('voice');
    expect(executor.runtime('voice').state).toBe('success');
  });

  it('a throw with no code is the core\'s own failure, not a provider\'s', async () => {
    const { executor, services } = setup();
    services.fail('voice', new Error('something broke'));
    await executor.run();
    expect(executor.runtime('voice').error?.code).toBe('NODE_RUN_FAILED');
  });

  it('cancel marks the running node cancelled and the rest blocked', async () => {
    const { executor, services } = setup();
    services.delay('voice', 5);
    services.fail('voice', failure('RUN_CANCELLED', 'aborted'));
    const p = executor.run();
    await new Promise((r) => setTimeout(r, 1));
    executor.cancel();
    const { ok } = await p;
    expect(ok).toBe(false);
    expect(executor.runtime('voice').state).toBe('cancelled');
    expect(executor.runtime('join').state).toBe('blocked');
  });

  it('run() refuses a graph that is malformed, not one that is merely unfinished', async () => {
    const { executor, graph } = setup();
    // An empty port stops that node and says so there; a cycle is a graph that cannot be run
    // at all, and that is what a refusal is for.
    graph.edges = graph.edges.filter((e) => e.id !== 'e2');
    const { ok } = await executor.run();
    expect(ok).toBe(false);
    expect(executor.runtime('join').blockedBy?.code).toBe('GRAPH_PORT_UNCONNECTED');

    graph.edges.push({ id: 'cyc', source: 'voice', sourcePort: 'out', target: 'source', targetPort: 'x' });
    await expect(executor.run()).rejects.toThrow(GraphInvalidError);
  });
});

describe('a run always ends', () => {
  const boomGraph = (): Graph => ({ nodes: [{ id: 'boom', type: 'test/boom', params: {}, bypassed: false, position: { x: 0, y: 0 } }], edges: [] });

  /** A node capsule with a bug in it: `preflight` is called outside the guard that catches a failing `run`. */
  function withThrowingPreflight() {
    const { services } = setup();
    registerNodeType({
      type: 'test/boom', version: 1, kind: 'source', inputs: [], outputs: [],
      paramsSchema: z.object({}), defaultParams: {},
      preflight: () => { throw new Error('preflight blew up'); },
      run: async () => ({}),
    } as unknown as AnyNodeDefinition);
    return new Executor(boomGraph(), services);
  }

  it('a throw escaping the run leaves the executor free to run again', async () => {
    const executor = withThrowingPreflight();
    await expect(executor.run()).rejects.toThrow('preflight blew up');
    expect(executor.isRunning()).toBe(false);
    // Before, `abort` stayed set and every later run answered "A run is already in progress"
    // until the server was restarted.
    await expect(executor.run()).rejects.toThrow('preflight blew up');
  });

  it('params the schema refuses fail their own node, not the run', async () => {
    const { services, graph } = setup();
    graph.nodes.find((n) => n.id === 'join')!.params.fps = 0;
    const executor = new Executor(graph, services);
    expect(await executor.runNode('join')).toBe('error');
    expect(executor.runtime('join').error?.code).toBe('NODE_PARAMS_INVALID');
    expect(executor.isRunning()).toBe(false);
  });
});

describe('the node state machine', () => {
  it('knows which changes have a path and which do not', () => {
    expect(canTransition('running', 'success')).toBe(true);
    // The signature cache answers from `queued` without ever running.
    expect(canTransition('queued', 'success')).toBe(true);
    // Bypassing, un-bypassing and queueing are things a person does, reachable from anywhere.
    expect(canTransition('error', 'bypassed')).toBe(true);
    expect(canTransition('error', 'queued')).toBe(true);
    // Nothing reaches a result without passing through the queue first.
    expect(canTransition('idle', 'success')).toBe(false);
    expect(canTransition('error', 'running')).toBe(false);
    expect(canTransition('bypassed', 'error')).toBe(false);
  });

  it('the executor refuses a state change with no path, under test', () => {
    const { executor } = setup();
    // `setState` is private on purpose; this reaches it the way a new code path would.
    const setState = (executor as unknown as { setState: (id: string, patch: { state: string }) => void }).setState.bind(executor);
    expect(() => setState('source', { state: 'success' })).toThrow(/illegal state change on source: idle → success/);
  });
});

describe('the way out of a failure', () => {
  const boom = (build: () => Error) => {
    const { services } = setup();
    registerNodeType({
      type: 'test/fails', version: 1, kind: 'source', inputs: [], outputs: [],
      paramsSchema: z.object({}), defaultParams: {},
      run: async () => { throw build(); },
    } as unknown as AnyNodeDefinition);
    const graph: Graph = { nodes: [{ id: 'f', type: 'test/fails', params: {}, bypassed: false, position: { x: 0, y: 0 } }], edges: [] };
    return new Executor(graph, services);
  };

  it('reaches the node from a NodeError', async () => {
    const executor = boom(() => new NodeError('ALIGN_FAILED', 'the aligner is not installed').withFix('npm run setup:align'));
    await executor.runNode('f');
    // It used to stop at the throw: NodeError had no `fix`, the runtime had no room for one, and
    // five capsules were writing a sentence for a person that nobody ever saw.
    expect(executor.runtime('f').error).toMatchObject({ code: 'ALIGN_FAILED', fix: 'npm run setup:align' });
  });

  it('reaches the node from a plain object a provider threw', async () => {
    const executor = boom(() => Object.assign(new Error('ffmpeg is missing'), { code: 'PROVIDER_NOT_INSTALLED', fix: 'brew install ffmpeg' }));
    await executor.runNode('f');
    expect(executor.runtime('f').error?.fix).toBe('brew install ffmpeg');
  });

  it('is simply absent when the failure has no remedy to offer', async () => {
    const executor = boom(() => new NodeError('LLM_UPSTREAM', 'the model refused'));
    await executor.runNode('f');
    expect(executor.runtime('f').error).toMatchObject({ code: 'LLM_UPSTREAM' });
    expect(executor.runtime('f').error?.fix).toBeUndefined();
  });
});
