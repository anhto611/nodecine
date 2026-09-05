import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Executor } from '../engine/executor';
import type { Graph } from '../engine/graph';
import { _resetNodeRegistry, registerCoreNodes, registerNodeType, type AnyNodeDefinition } from '../nodes';
import { AI_DIRECTOR } from '../nodes/ai-director';
import { _resetSceneRegistry, registerScene } from '../scenes/registry';
import { registerCoreScenes, TITLE_CARD } from '../scenes/title-card';
import { makeFakeServices } from './fakes';

/**
 * The GitHub showcase, rebuilt from parts a user can reach: a fact source, the one director with a
 * brief and three slots, and a hook scene whose star count is bound to a fact. If this works, the
 * per-video director was never necessary.
 */

const HOOK = 'test/hook';
registerScene({ sceneType: HOOK, propsSchema: z.object({ headline: z.string().max(60), stars: z.number().int().nullable().optional() }) });

const facts = {
  facts: { name: 'widget', description: 'Tiny widgets for the web.', stars: 4321, url: 'github.com/acme/widget' },
  sourceLabel: 'github.com/acme/widget',
  fetchedAt: '2026-09-05T00:00:00.000Z',
  mode: 'fetched' as const,
};

const factSource: AnyNodeDefinition = {
  type: 'test/facts', version: 1, namespace: 'test', kind: 'source', inputs: [],
  outputs: [{ name: 'facts', type: 'FactSheet' }],
  paramsSchema: z.object({}), defaultParams: {},
  run: async () => ({ facts }),
} as unknown as AnyNodeDefinition;

const director = (params: Record<string, unknown>) => ({ id: 'dir', type: AI_DIRECTOR, params, bypassed: false, position: { x: 0, y: 0 } });
const llm = { id: 'llm', type: 'core/llm-provider', params: { providerId: 'claude-code', settings: {} }, bypassed: false, position: { x: 0, y: 0 } };
const factsNode = { id: 'facts', type: 'test/facts', params: {}, bypassed: false, position: { x: 0, y: 0 } };
const wires = (withFacts: boolean) => [
  { id: 'e1', source: 'llm', sourcePort: 'llm', target: 'dir', targetPort: 'llm' },
  ...(withFacts ? [{ id: 'e2', source: 'facts', sourcePort: 'facts', target: 'dir', targetPort: 'facts' }] : []),
];

const showcaseParams = {
  prompt: 'Introduce this project to busy developers. Confident, no hype.',
  outputLanguage: 'en',
  theme: 'core/dark',
  scenes: [
    { sceneType: TITLE_CARD, weight: 0.5, count: 1, factBindings: {} },
    { sceneType: HOOK, weight: 1, count: 1, factBindings: { stars: 'stars' } },
    { sceneType: TITLE_CARD, weight: 1, count: 1, factBindings: { headline: 'name' } },
  ],
};

const goodAnswer = {
  language: 'en',
  audioScript: 'Meet widget, the tiniest way to build widgets for the web. Install it, wire it up, and ship.',
  scenes: [{ headline: 'MEET WIDGET' }, { headline: 'TINY WIDGETS, BIG WEB' }, { headline: 'ignored, bound to name' }],
};

beforeEach(() => {
  _resetNodeRegistry();
  _resetSceneRegistry();
  registerCoreScenes();
  registerScene({ sceneType: HOOK, propsSchema: z.object({ headline: z.string().max(60), stars: z.number().int().nullable().optional() }) });
  registerCoreNodes();
  registerNodeType(factSource);
});

describe('core/ai-director', () => {
  it('rebuilds the GitHub showcase from a brief and three slots, and keeps facts out of the prompt', async () => {
    const services = makeFakeServices({ complete: async () => goodAnswer });
    const g: Graph = { nodes: [factsNode, llm, director(showcaseParams)], edges: wires(true) };
    const ex = new Executor(g, services);
    const { ok } = await ex.run();
    expect(ok).toBe(true);

    const rt = ex.runtimes_().get('dir')!;
    const plan = rt.outputs.plan!.payload as { scenes: { sceneType: string; factBindings?: Record<string, string>; props: Record<string, unknown> }[] };
    expect(plan.scenes.map((s) => s.sceneType)).toEqual([TITLE_CARD, HOOK, TITLE_CARD]);
    expect(plan.scenes[1]!.factBindings).toEqual({ stars: 'stars' });
    // The model's value for a bound prop is dropped; the assembler fills it from the fact later.
    expect('headline' in plan.scenes[2]!.props).toBe(false);

    const prompt = services.calls.find((c) => c.name === 'complete')!.args[0] as string;
    expect(prompt).toContain('Introduce this project');
    expect(prompt).toContain('Tiny widgets for the web.');
    expect(prompt).not.toContain('4321'); // bound → never shown to the model
    expect(prompt).toContain('github.com/acme/widget'); // not bound → shown
  });

  it('holds the model to the exact scene count', async () => {
    let calls = 0;
    const services = makeFakeServices({
      complete: async () => {
        calls++;
        return calls === 1 ? { ...goodAnswer, scenes: goodAnswer.scenes.slice(0, 2) } : goodAnswer;
      },
    });
    const g: Graph = { nodes: [factsNode, llm, director(showcaseParams)], edges: wires(true) };
    const ex = new Executor(g, services);
    await ex.run();
    expect(calls).toBe(2);
    expect(ex.runtimes_().get('dir')!.state).toBe('success');
  });

  it('works with no facts wired in at all', async () => {
    const services = makeFakeServices({ complete: async () => ({ language: 'en', audioScript: goodAnswer.audioScript, scenes: [{ headline: 'A' }, { headline: 'B' }] }) });
    const params = { ...showcaseParams, scenes: [{ sceneType: TITLE_CARD, weight: 1, count: 2, factBindings: {} }] };
    const g: Graph = { nodes: [llm, director(params)], edges: wires(false) };
    const ex = new Executor(g, services);
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    const prompt = services.calls.find((c) => c.name === 'complete')!.args[0] as string;
    expect(prompt).not.toContain('Facts about the subject');
  });

  it('blocks before spending a model call when a slot names a scene type nothing registered', async () => {
    const services = makeFakeServices({ complete: async () => goodAnswer });
    const params = { ...showcaseParams, scenes: [{ sceneType: 'ghost/scene', weight: 1, count: 1, factBindings: {} }] };
    const g: Graph = { nodes: [llm, director(params)], edges: wires(false) };
    const ex = new Executor(g, services);
    const { ok } = await ex.run();
    expect(ok).toBe(false);
    const rt = ex.runtimes_().get('dir')!;
    expect(rt.state).toBe('blocked');
    expect(rt.blockedBy?.code).toBe('NODE_PARAMS_INVALID');
    expect(rt.blockedBy?.message).toContain('ghost/scene');
    expect(services.calls.some((c) => c.name === 'complete')).toBe(false);
  });

  it('detects the output language from the brief when asked to', async () => {
    const services = makeFakeServices({ complete: async () => ({ language: 'vi', audioScript: 'Một lời dẫn đủ dài để tính là một đoạn.', scenes: [{ headline: 'XIN CHÀO' }] }) });
    const params = { ...showcaseParams, prompt: 'Giới thiệu dự án này cho lập trình viên bận rộn.', outputLanguage: 'auto', scenes: [{ sceneType: TITLE_CARD, weight: 1, count: 1, factBindings: {} }] };
    const g: Graph = { nodes: [llm, director(params)], edges: wires(false) };
    const ex = new Executor(g, services);
    await ex.run();
    const prompt = services.calls.find((c) => c.name === 'complete')!.args[0] as string;
    expect(prompt).toContain('Vietnamese');
    expect((ex.runtimes_().get('dir')!.outputs.script!.payload as { language: string }).language).toBe('vi');
  });
});
