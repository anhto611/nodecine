import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { Executor } from '../engine/executor';
import { validateGraph, GraphInvalidError, type Graph } from '../engine/graph';
import { _resetNodeRegistry, registerNodeType, type AnyNodeDefinition } from '../nodes/definition';
import { canTransition } from '../engine/state';
import { NodeError } from '../errors';
import { registerNodes } from '@/nodes';
import staticScriptJson from '@/lib/first-run.json';
const staticScriptTemplate = (): Graph => structuredClone(staticScriptJson.graph as Graph);
import { validateIR } from '../types/validate-ir';
import type { VideoIR } from '../types/ir';
import { makeFakeServices, registerFakeEngineSupport, resetEngineSupport } from './fakes';

function setup(opts: Parameters<typeof makeFakeServices>[0] = {}, withRenderer = true) {
  _resetNodeRegistry();
  resetEngineSupport();
  registerNodes();
  if (withRenderer) registerFakeEngineSupport();
  const services = makeFakeServices(opts);
  const graph = staticScriptTemplate();
  const states: string[] = [];
  const executor = new Executor(graph, services, { onStateChange: (id, rt) => states.push(`${id}:${rt.state}`) });
  return { services, graph, executor, states };
}

beforeEach(() => { /* per-test setup() */ });

describe('graph validation', () => {
  it('the Phase A template is valid with no blocking issues', () => {
    setup();
    const issues = validateGraph(staticScriptTemplate());
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
  it('an unconnected required input disables Run; a missing provider gets PROVIDER_NOT_CONNECTED', () => {
    const { graph } = setup();
    graph.edges = graph.edges.filter((e) => e.id !== 'e3');
    const issues = validateGraph(graph);
    expect(issues.some((i) => i.code === 'PROVIDER_NOT_CONNECTED' && i.nodeId === 'tts')).toBe(true);
  });
  it('detects cycles and reports the offending edges', () => {
    const { graph } = setup();
    graph.edges.push({ id: 'cyc', source: 'assembler', sourcePort: 'ir', target: 'script', targetPort: 'x' });
    const issues = validateGraph(graph);
    expect(issues.find((i) => i.code === 'GRAPH_CYCLE')?.edgeIds).toContain('cyc');
  });
  it('a graph with no sink only warns', () => {
    const { graph } = setup();
    graph.nodes = graph.nodes.filter((n) => n.id !== 'output' && n.id !== 'export');
    graph.edges = graph.edges.filter((e) => !['e5', 'e6', 'e7', 'e8'].includes(e.id));
    const issues = validateGraph(graph);
    expect(issues.find((i) => i.code === 'GRAPH_NO_SINK')?.severity).toBe('warning');
    expect(issues.some((i) => i.severity === 'error')).toBe(false);
  });
  it('an empty Input Trigger is a continuous INPUT_EMPTY error', () => {
    setup();
    const g: Graph = { nodes: [{ id: 'in', type: 'core/input-trigger', params: { value: '  ' }, bypassed: false, position: { x: 0, y: 0 } }], edges: [] };
    expect(validateGraph(g).some((i) => i.code === 'INPUT_EMPTY')).toBe(true);
  });
});

describe('Phase A run', () => {
  it('runs six nodes, skips the bypassed export, and produces a valid IR in the player node', async () => {
    const { executor, services } = setup();
    const { ok } = await executor.run();
    expect(ok).toBe(true);
    for (const id of ['script', 'tts-provider', 'tts', 'assembler', 'engine', 'output']) expect(executor.runtime(id).state).toBe('success');
    expect(executor.runtime('export').state).toBe('bypassed');
    const ir = executor.runtime('assembler').outputs.ir!.payload as VideoIR;
    expect(validateIR(ir)).toEqual({ ok: true, warnings: [] });
    expect(ir.beats).toHaveLength(3);
    expect(ir.beats.reduce((a, b) => a + b.durationInFrames, 0)).toBe(ir.meta.totalDurationInFrames);
    expect(services.calls.filter((c) => c.name === 'render')).toHaveLength(0);
  });

  it('gathers Layer nodes on the assembler\'s layers port, in wire order, into tracks around the scenes', async () => {
    const { executor, graph } = setup();
    const clip = '/api/assets/' + 'c'.repeat(16) + '.mp4';
    graph.nodes.push(
      { id: 'bg', type: 'core/layer', params: { kind: 'media', url: clip, placement: 'under', fit: 'cover', loop: true, offsetSeconds: 0, gain: 0, startSeconds: 0, source: '' }, bypassed: false, position: { x: 0, y: 0 } },
      { id: 'phone', type: 'core/layer', params: { kind: 'code', source: '<div class="phone"></div>', placement: 'over', fit: 'cover', loop: true, offsetSeconds: 0, gain: 0, startSeconds: 0, url: '' }, bypassed: false, position: { x: 0, y: 0 } },
    );
    graph.edges.push(
      { id: 'l1', source: 'bg', sourcePort: 'layer', target: 'assembler', targetPort: 'layers' },
      { id: 'l2', source: 'phone', sourcePort: 'layer', target: 'assembler', targetPort: 'layers' },
    );
    expect(validateGraph(graph).filter((i) => i.severity === 'error')).toEqual([]);
    executor.setGraph(graph);
    const { ok } = await executor.run();
    expect(ok).toBe(true);
    const ir = executor.runtime('assembler').outputs.ir!.payload as VideoIR;
    expect(ir.tracks.map((t) => t.id)).toEqual(['layer-1', 'scenes', 'layer-2']);
    expect(ir.tracks[0]!.clips[0]).toMatchObject({ kind: 'media', url: clip, durationInFrames: ir.meta.totalDurationInFrames });
    expect(validateIR(ir)).toEqual({ ok: true, warnings: [] });
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

    const moved = { ...graph, nodes: graph.nodes.map((n) => (n.id === 'export' ? { ...n, position: { x: n.position.x + 120, y: n.position.y + 40 } } : n)) };
    executor.setGraph(moved);

    expect(executor.runtime('export').state).toBe('success');
    expect(executor.runtime('export').result).toBe(before);
  });

  it('second run reuses everything; changing TTS speed re-runs only TTS and downstream', async () => {
    const { executor, services, graph } = setup();
    await executor.run();
    const probes = () => services.calls.filter((c) => c.name.startsWith('probe')).length;
    // Three scenes, three narrations: the TTS engine voices each and joins them.
    const synths = () => services.calls.filter((c) => c.name === 'synthesize').length;
    expect(synths()).toBe(3);
    expect(services.calls.filter((c) => c.name === 'concatAudio')).toHaveLength(1);

    await executor.run();
    expect(executor.runtime('script').reused).toBe(true);
    expect(executor.runtime('tts').reused).toBe(true);
    expect(executor.runtime('assembler').reused).toBe(true);
    expect(synths()).toBe(3);
    // resource nodes always re-probe (EXECUTION_ENGINE §1.1) but their unchanged hash lets downstream reuse: three of them, twice
    expect(probes()).toBe(6);
    expect(executor.runtime('tts-provider').reused).toBe(false);

    graph.nodes.find((n) => n.id === 'tts')!.params.speed = 1.15;
    executor.invalidate('tts');
    expect(executor.runtime('assembler').state).toBe('stale');
    await executor.run();
    expect(synths()).toBe(6);
    expect(executor.runtime('script').reused).toBe(true);
    expect(executor.runtime('tts').reused).toBe(false);
    expect(executor.runtime('assembler').reused).toBe(false);
    expect(executor.runtime('output').reused).toBe(false);
  });

  it('a Vietnamese script is detected and picks a Vietnamese voice with no extra input', async () => {
    const { executor, graph, services } = setup();
    const vi = graph.nodes.find((n) => n.id === 'script')!.params as { scenes: { narration: string }[] };
    vi.scenes = vi.scenes.map((s) => ({ ...s, narration: 'Gặp NodeCine. Dựng video ngắn từ đồ thị node.' }));
    await executor.run();
    const synth = services.calls.find((c) => c.name === 'synthesize')!;
    expect(synth.args[1]).toBe('linh');
  });

  it('missing voice for the language falls back and logs TTS_VOICE_LANGUAGE_MISMATCH without failing', async () => {
    const { executor, graph } = setup({ voices: [{ id: 'samantha', displayName: 'Samantha', language: 'en-US' }] });
    const ja = graph.nodes.find((n) => n.id === 'script')!.params as { scenes: { narration: string }[] };
    ja.scenes = ja.scenes.map((s) => ({ ...s, narration: 'ノードグラフから短い動画を作る。' }));
    const { ok } = await executor.run();
    expect(ok).toBe(true);
    expect(executor.logs.all().some((l) => l.code === 'TTS_VOICE_LANGUAGE_MISMATCH')).toBe(true);
  });
});

describe('resource nodes and capability blocking (EXECUTION_ENGINE §1.1)', () => {
  it('missing ffmpeg: provider is success (yellow), TTS engine is blocked by capability with the fix', async () => {
    const { executor, services } = setup({ encoder: false });
    const { ok } = await executor.run();
    expect(ok).toBe(false);
    expect(executor.runtime('tts-provider').state).toBe('success');
    const tts = executor.runtime('tts');
    expect(tts.state).toBe('blocked');
    expect(tts.blockedBy).toMatchObject({ kind: 'capability', code: 'PROVIDER_NOT_INSTALLED', fix: 'brew install ffmpeg' });
    expect(services.calls.some((c) => c.name === 'synthesize')).toBe(false);
    expect(executor.runtime('assembler').state).toBe('blocked');
    expect(executor.runtime('assembler').blockedBy?.kind).toBe('upstream');
  });

  it('a node blocked behind another reports the original cause, not an unwired port', async () => {
    const { executor } = setup({ encoder: false });
    await executor.run();
    // The assembler is three steps from the missing encoder, and still names it.
    expect(executor.runtime('assembler').blockedBy).toMatchObject({
      code: 'PROVIDER_NOT_INSTALLED',
      fix: 'brew install ffmpeg',
      nodeId: 'tts',
    });
  });

  it('the world changing between runs is detected because probe() always re-runs', async () => {
    const { executor, services } = setup();
    await executor.run();
    services.setOptions({ encoder: false });
    await executor.run();
    expect(executor.runtime('tts').state).toBe('blocked');
  });

  it('swapping to Remotion blocks the player by capability (no html-gsap renderer) and re-runs nothing upstream', async () => {
    const { executor, graph, services } = setup();
    await executor.run();
    graph.nodes.find((n) => n.id === 'engine')!.type = 'core/remotion-engine';
    graph.nodes.find((n) => n.id === 'engine')!.params = { glBackend: 'angle' };
    executor.invalidate('engine');
    const synthsBefore = services.calls.filter((c) => c.name === 'synthesize').length;
    await executor.run();
    expect(executor.runtime('output').state).toBe('blocked');
    expect(executor.runtime('output').blockedBy?.code).toBe('ENGINE_SCENE_UNSUPPORTED');
    expect(services.calls.filter((c) => c.name === 'synthesize').length).toBe(synthsBefore);
    expect(executor.runtime('assembler').reused).toBe(true);
  });

  it('a scene-code format the engine cannot draw blocks the player with ENGINE_SCENE_UNSUPPORTED', async () => {
    const { executor } = setup({}, false);
    await executor.run();
    const out = executor.runtime('output');
    expect(out.state).toBe('blocked');
    expect(out.blockedBy?.code).toBe('ENGINE_SCENE_UNSUPPORTED');
    expect(out.blockedBy?.message).toContain('html-gsap');
  });
});

describe('on-demand export and single-node runs (EXECUTION_ENGINE §3)', () => {
  it('Render runs only the export node using the packets already on its inputs', async () => {
    const { executor, services } = setup();
    await executor.run();
    const before = services.calls.length;
    const state = await executor.runNode('export');
    expect(state).toBe('success');
    expect(executor.runtime('export').result).toMatchObject({ bytes: 4_800_000, fileName: 'static-script.mp4' });
    const after = services.calls.slice(before).map((c) => c.name);
    expect(after).toEqual(['render']);
  });
  it('Render before any run is refused with the missing port', async () => {
    const { executor } = setup();
    await expect(executor.runNode('export')).rejects.toThrow(/has no packet/);
  });
  it('un-bypassing the export makes it run on the next Run', async () => {
    const { executor, services } = setup();
    executor.setBypassed('export', false);
    await executor.run();
    expect(executor.runtime('export').state).toBe('success');
    expect(services.calls.some((c) => c.name === 'render')).toBe(true);
  });
  it('a render with the engine lacking render capability is blocked, not errored', async () => {
    const { executor } = setup({ renderReady: false });
    await executor.run();
    await expect(executor.runNode('export')).resolves.toBe('blocked');
    expect(executor.runtime('export').blockedBy?.code).toBe('ENGINE_NOT_READY');
  });
});

describe('errors and cancellation', () => {
  it('a node error blocks downstream, keeps earlier results, and retry fixes it', async () => {
    const { executor, services } = setup();
    let fail = true;
    const realSynth = services.synthesize.bind(services);
    services.synthesize = async (...args) => {
      if (fail) throw Object.assign(new Error('say exited 1'), { code: 'PROVIDER_PROCESS_FAILED' });
      return realSynth(...args);
    };
    const { ok } = await executor.run();
    expect(ok).toBe(false);
    expect(executor.runtime('tts').state).toBe('error');
    expect(executor.runtime('tts').error?.code).toBe('PROVIDER_PROCESS_FAILED');
    expect(executor.runtime('assembler').state).toBe('blocked');
    expect(executor.runtime('script').state).toBe('success');
    fail = false;
    await executor.runNode('tts');
    expect(executor.runtime('tts').state).toBe('success');
  });

  it('cancel marks the running node cancelled and the rest blocked', async () => {
    const { executor, services } = setup();
    services.synthesize = () => new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('aborted'), { code: 'RUN_CANCELLED' })), 5));
    const p = executor.run();
    await new Promise((r) => setTimeout(r, 1));
    executor.cancel();
    const { ok } = await p;
    expect(ok).toBe(false);
    expect(executor.runtime('tts').state).toBe('cancelled');
    expect(executor.runtime('assembler').state).toBe('blocked');
  });

  it('run() refuses an invalid graph', async () => {
    const { executor, graph } = setup();
    graph.edges = graph.edges.filter((e) => e.id !== 'e2');
    await expect(executor.run()).rejects.toThrow(GraphInvalidError);
  });
});

describe('a run always ends', () => {
  const boomGraph = (): Graph => ({ nodes: [{ id: 'boom', type: 'test/boom', params: {}, bypassed: false, position: { x: 0, y: 0 } }], edges: [] });

  /** A node capsule with a bug in it: `preflight` is called outside the guard that catches a failing `run`. */
  function withThrowingPreflight() {
    const { services } = setup();
    registerNodeType({
      type: 'test/boom',
      version: 1,
      kind: 'source',
      inputs: [],
      outputs: [],
      paramsSchema: z.object({}),
      defaultParams: {},
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
    graph.nodes.find((n) => n.id === 'assembler')!.params.fps = 0;
    const executor = new Executor(graph, services);
    const state = await executor.runNode('assembler');
    expect(state).toBe('error');
    expect(executor.runtime('assembler').error?.code).toBe('NODE_PARAMS_INVALID');
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
    expect(() => setState('script', { state: 'success' })).toThrow(/illegal state change on script: idle → success/);
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
