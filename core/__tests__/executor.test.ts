import { describe, it, expect, beforeEach } from 'vitest';
import { Executor } from '../engine/executor';
import { validateGraph, GraphInvalidError, type Graph } from '../engine/graph';
import { _resetNodeRegistry } from '../nodes/definition';
import { registerCoreNodes } from '../nodes';
import { _resetSceneRegistry, registerSceneRenderer } from '../scenes/registry';
import { registerCoreScenes, TITLE_CARD } from '../scenes/title-card';
import { staticScriptTemplate } from '../templates/static-script';
import { validateIR } from '../assembler/validate-ir';
import type { VideoIR } from '../types/ir';
import { makeFakeServices } from './fakes';

function setup(opts: Parameters<typeof makeFakeServices>[0] = {}, withRenderer = true) {
  _resetNodeRegistry();
  _resetSceneRegistry();
  registerCoreNodes();
  registerCoreScenes();
  if (withRenderer) registerSceneRenderer(TITLE_CARD, 'remotion', () => null);
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
    for (const id of ['script', 'tts-provider', 'tts', 'assembler', 'remotion', 'output']) expect(executor.runtime(id).state).toBe('success');
    expect(executor.runtime('export').state).toBe('bypassed');
    const ir = executor.runtime('assembler').outputs.ir!.payload as VideoIR;
    expect(validateIR(ir)).toEqual({ ok: true });
    expect(ir.timeline).toHaveLength(3);
    expect(ir.timeline.reduce((a, s) => a + s.durationInFrames, 0)).toBe(ir.meta.totalDurationInFrames);
    expect(services.calls.filter((c) => c.name === 'render')).toHaveLength(0);
  });

  it('second run reuses everything; changing TTS speed re-runs only TTS and downstream', async () => {
    const { executor, services, graph } = setup();
    await executor.run();
    const probes = () => services.calls.filter((c) => c.name.startsWith('probe')).length;
    const synths = () => services.calls.filter((c) => c.name === 'synthesize').length;
    expect(synths()).toBe(1);

    await executor.run();
    expect(executor.runtime('script').reused).toBe(true);
    expect(executor.runtime('tts').reused).toBe(true);
    expect(executor.runtime('assembler').reused).toBe(true);
    expect(synths()).toBe(1);
    // resource nodes always re-probe (EXECUTION_ENGINE §1.1) but their unchanged hash lets downstream reuse
    expect(probes()).toBe(4);
    expect(executor.runtime('tts-provider').reused).toBe(false);

    graph.nodes.find((n) => n.id === 'tts')!.params.speed = 1.15;
    executor.invalidate('tts');
    expect(executor.runtime('assembler').state).toBe('stale');
    await executor.run();
    expect(synths()).toBe(2);
    expect(executor.runtime('script').reused).toBe(true);
    expect(executor.runtime('tts').reused).toBe(false);
    expect(executor.runtime('assembler').reused).toBe(false);
    expect(executor.runtime('output').reused).toBe(false);
  });

  it('a Vietnamese script is detected and picks a Vietnamese voice with no extra input', async () => {
    const { executor, graph, services } = setup();
    graph.nodes.find((n) => n.id === 'script')!.params.script = 'Gặp NodeCine. Dựng video ngắn từ đồ thị khối.';
    await executor.run();
    const synth = services.calls.find((c) => c.name === 'synthesize')!;
    expect(synth.args[1]).toBe('linh');
  });

  it('missing voice for the language falls back and logs TTS_VOICE_LANGUAGE_MISMATCH without failing', async () => {
    const { executor, graph } = setup({ voices: [{ id: 'samantha', displayName: 'Samantha', language: 'en-US' }] });
    graph.nodes.find((n) => n.id === 'script')!.params.script = 'ノードグラフから短い動画を作る。';
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

  it('the world changing between runs is detected because probe() always re-runs', async () => {
    const { executor, services } = setup();
    await executor.run();
    services.setOptions({ encoder: false });
    await executor.run();
    expect(executor.runtime('tts').state).toBe('blocked');
  });

  it('swapping to Hyperframes blocks the player by capability and re-runs nothing upstream', async () => {
    const { executor, graph, services } = setup();
    await executor.run();
    graph.nodes.find((n) => n.id === 'remotion')!.type = 'core/hyperframes-engine';
    graph.nodes.find((n) => n.id === 'remotion')!.params = {};
    executor.invalidate('remotion');
    const synthsBefore = services.calls.filter((c) => c.name === 'synthesize').length;
    await executor.run();
    expect(executor.runtime('output').state).toBe('blocked');
    expect(executor.runtime('output').blockedBy?.code).toBe('ENGINE_NOT_READY');
    expect(services.calls.filter((c) => c.name === 'synthesize').length).toBe(synthsBefore);
    expect(executor.runtime('assembler').reused).toBe(true);
  });

  it('a scene type without a renderer for the engine blocks the player with ENGINE_SCENE_UNSUPPORTED', async () => {
    const { executor } = setup({}, false);
    await executor.run();
    const out = executor.runtime('output');
    expect(out.state).toBe('blocked');
    expect(out.blockedBy?.code).toBe('ENGINE_SCENE_UNSUPPORTED');
    expect(out.blockedBy?.message).toContain(TITLE_CARD);
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
    const { executor } = setup({ remotionRender: false });
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
