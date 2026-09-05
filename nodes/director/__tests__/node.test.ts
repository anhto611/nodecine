import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Executor } from '@/core/engine/executor';
import type { Graph } from '@/core/engine/graph';
import { registerNodes } from '@/nodes';
import { _resetNodeRegistry, registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import { AI_DIRECTOR } from '@/nodes/director/node';
import { makeFakeServices } from '@/core/__tests__/fakes';
import { HOOK, TEXT_CARD, lookNodes } from '@/core/__tests__/look-fixtures';

/**
 * The GitHub showcase, rebuilt from parts a user can reach: a fact source, a stage, two blocks, and
 * the one director with a brief and three beats — one of them with the star count bound to a fact.
 */

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
const look = lookNodes('dir', [TEXT_CARD, HOOK]);
const graph = (params: Record<string, unknown>, withFacts: boolean): Graph => ({
  nodes: [...look.nodes, ...(withFacts ? [factsNode] : []), llm, director(params)],
  edges: [
    ...look.edges,
    { id: 'e1', source: 'llm', sourcePort: 'llm', target: 'dir', targetPort: 'llm' },
    ...(withFacts ? [{ id: 'e2', source: 'facts', sourcePort: 'facts', target: 'dir', targetPort: 'facts' }] : []),
  ],
});

const showcaseParams = {
  prompt: 'Introduce this project to busy developers. Confident, no hype.',
  outputLanguage: 'en',
  beats: [
    { role: 'open', brief: '', weight: 0.5, count: 1, blocks: ['text-card'], factBindings: {} },
    { role: 'hook', brief: 'What it is.', weight: 1, count: 1, blocks: ['hook'], factBindings: { stars: 'stars' } },
    { role: 'close', brief: '', weight: 1, count: 1, blocks: [], factBindings: { headline: 'name' } },
  ],
};

const goodAnswer = {
  language: 'en',
  audioScript: 'Meet widget, the tiniest way to build widgets for the web. Install it, wire it up, and ship.',
  scenes: [
    { block: 'text-card', tone: 'cool', fields: { kicker: 'MEET' }, props: { headline: 'MEET WIDGET' } },
    { block: 'hook', props: { headline: 'TINY WIDGETS, BIG WEB', stars: 1 } },
    { block: 'text-card', props: { headline: 'ignored, bound to name' } },
  ],
};

beforeEach(() => {
  _resetNodeRegistry();
  registerNodes();
  registerNodeType(factSource);
});

describe('core/ai-director', () => {
  it('rebuilds the GitHub showcase from a brief, a look and three beats, and keeps facts out of the prompt', async () => {
    const services = makeFakeServices({ complete: async () => goodAnswer });
    const ex = new Executor(graph(showcaseParams, true), services);
    const { ok } = await ex.run();
    expect(ok).toBe(true);

    const rt = ex.runtimes_().get('dir')!;
    const plan = rt.outputs.plan!.payload as { stage: { id: string }; blocks: { id: string }[]; scenes: { blockId: string; tone?: string; fields?: Record<string, string>; factBindings?: Record<string, string>; props: Record<string, unknown> }[] };
    expect(plan.stage.id).toBe('dark');
    expect(plan.blocks.map((b) => b.id)).toEqual(['text-card', 'hook']);
    expect(plan.scenes.map((s) => s.blockId)).toEqual(['text-card', 'hook', 'text-card']);
    expect(plan.scenes[0]!.tone).toBe('cool');
    expect(plan.scenes[0]!.fields).toEqual({ kicker: 'MEET' });
    expect(plan.scenes[1]!.factBindings).toEqual({ stars: 'stars' });
    // The model's value for a bound prop is dropped; the assembler fills it from the fact later.
    expect('stars' in plan.scenes[1]!.props).toBe(false);
    expect('headline' in plan.scenes[2]!.props).toBe(false);

    const prompt = services.calls.find((c) => c.name === 'complete')!.args[0] as string;
    expect(prompt).toContain('Introduce this project');
    expect(prompt).toContain('Tiny widgets for the web.');
    expect(prompt).not.toContain('4321'); // bound → never shown to the model
    expect(prompt).toContain('github.com/acme/widget'); // not bound → shown
    expect(prompt).toContain('An opening line; stars come from data.'); // the block's own doc
  });

  it('holds the model to the exact scene count', async () => {
    let calls = 0;
    const services = makeFakeServices({
      complete: async () => {
        calls++;
        return calls === 1 ? { ...goodAnswer, scenes: goodAnswer.scenes.slice(0, 2) } : goodAnswer;
      },
    });
    const ex = new Executor(graph(showcaseParams, true), services);
    await ex.run();
    expect(calls).toBe(2);
    expect(ex.runtimes_().get('dir')!.state).toBe('success');
  });

  it('holds the model to the beat\'s block list', async () => {
    let calls = 0;
    const services = makeFakeServices({
      complete: async () => {
        calls++;
        return calls === 1 ? { ...goodAnswer, scenes: [goodAnswer.scenes[0], { block: 'text-card', props: { headline: 'wrong block' } }, goodAnswer.scenes[2]] } : goodAnswer;
      },
    });
    const ex = new Executor(graph(showcaseParams, true), services);
    await ex.run();
    expect(calls).toBe(2);
    expect(ex.runtimes_().get('dir')!.state).toBe('success');
  });

  it('works with no facts wired in at all', async () => {
    const services = makeFakeServices({ complete: async () => ({ language: 'en', audioScript: goodAnswer.audioScript, scenes: [{ block: 'text-card', props: { headline: 'A' } }, { block: 'hook', props: { headline: 'B' } }] }) });
    const params = { ...showcaseParams, beats: [{ role: 'x', brief: '', weight: 1, count: 2, blocks: [], factBindings: {} }] };
    const ex = new Executor(graph(params, false), services);
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    const prompt = services.calls.find((c) => c.name === 'complete')!.args[0] as string;
    expect(prompt).not.toContain('Facts about the subject');
  });

  it('blocks before spending a model call when a beat names a block that is not wired', async () => {
    const services = makeFakeServices({ complete: async () => goodAnswer });
    const params = { ...showcaseParams, beats: [{ role: 'x', brief: '', weight: 1, count: 1, blocks: ['ghost'], factBindings: {} }] };
    const ex = new Executor(graph(params, false), services);
    const { ok } = await ex.run();
    expect(ok).toBe(false);
    const rt = ex.runtimes_().get('dir')!;
    expect(rt.state).toBe('blocked');
    expect(rt.blockedBy?.code).toBe('NODE_PARAMS_INVALID');
    expect(rt.blockedBy?.message).toContain('ghost');
    expect(services.calls.some((c) => c.name === 'complete')).toBe(false);
  });

  it('blocks when two wired Blocks nodes carry the same id', async () => {
    const services = makeFakeServices({ complete: async () => goodAnswer });
    const g = graph(showcaseParams, false);
    g.nodes.push({ id: 'blocks-dupe', type: 'core/blocks', params: { blocks: [{ ...HOOK }] }, bypassed: false, position: { x: 0, y: 0 } });
    g.edges.push({ id: 'look-dupe', source: 'blocks-dupe', sourcePort: 'blocks', target: 'dir', targetPort: 'blocks' });
    const ex = new Executor(g, services);
    await ex.run();
    const rt = ex.runtimes_().get('dir')!;
    expect(rt.state).toBe('blocked');
    expect(rt.blockedBy?.message).toContain('hook');
  });

  it('detects the output language from the brief when asked to', async () => {
    const services = makeFakeServices({ complete: async () => ({ language: 'vi', audioScript: 'Một lời dẫn đủ dài để tính là một đoạn.', scenes: [{ block: 'text-card', props: { headline: 'XIN CHÀO' } }] }) });
    const params = { ...showcaseParams, prompt: 'Giới thiệu dự án này cho lập trình viên bận rộn.', outputLanguage: 'auto', beats: [{ role: 'x', brief: '', weight: 1, count: 1, blocks: ['text-card'], factBindings: {} }] };
    const ex = new Executor(graph(params, false), services);
    await ex.run();
    const prompt = services.calls.find((c) => c.name === 'complete')!.args[0] as string;
    expect(prompt).toContain('Vietnamese');
    expect((ex.runtimes_().get('dir')!.outputs.script!.payload as { language: string }).language).toBe('vi');
  });
});
