import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Executor } from '@/core/engine/executor';
import type { Graph } from '@/core/engine/graph';
import { registerNodes } from '@/nodes';
import { _resetNodeRegistry, registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import { SCREENWRITER } from '@/nodes/screenwriter/node';
import { makeFakeServices } from '@/core/__tests__/fakes';
import { HOOK, TEXT_CARD, lookNode } from '@/core/__tests__/look-fixtures';
import type { ScenePlan, SceneScript } from '@/core/types/payloads';

/**
 * The GitHub showcase, rebuilt from parts a user can reach: a fact source, the one director with a
 * brief and three beats — one of them with the star count bound to a fact — and, after it, an Art
 * Director with two blocks that casts what the screenwriter wrote.
 */

const facts = {
  facts: { name: 'widget', description: 'Tiny widgets for the web.', stars: 4321, url: 'github.com/acme/widget' },
  sourceLabel: 'github.com/acme/widget',
  fetchedAt: '2026-09-05T00:00:00.000Z',
  mode: 'fetched' as const,
};

const factSource: AnyNodeDefinition = {
  type: 'test/facts', version: 1, kind: 'source', inputs: [],
  outputs: [{ name: 'facts', type: 'FactSheet' }],
  paramsSchema: z.object({}), defaultParams: {},
  run: async () => ({ facts }),
} as unknown as AnyNodeDefinition;

const director = (params: Record<string, unknown>) => ({ id: 'writer', type: SCREENWRITER, params, bypassed: false, position: { x: 0, y: 0 } });
const llm = { id: 'llm', type: 'core/llm-provider', params: { providerId: 'claude-code', settings: {} }, bypassed: false, position: { x: 0, y: 0 } };
const factsNode = { id: 'facts', type: 'test/facts', params: {}, bypassed: false, position: { x: 0, y: 0 } };
const look = lookNode('art', [TEXT_CARD, HOOK], [{ role: 'hook', block: 'hook' }, { role: 'open', tone: 'cool' }]);
const graph = (params: Record<string, unknown>, withFacts: boolean): Graph => ({
  nodes: [...(withFacts ? [factsNode] : []), llm, director(params), look],
  edges: [
    { id: 'e1', source: 'llm', sourcePort: 'llm', target: 'writer', targetPort: 'llm' },
    ...(withFacts ? [{ id: 'e2', source: 'facts', sourcePort: 'facts', target: 'writer', targetPort: 'facts' }] : []),
    { id: 'e3', source: 'writer', sourcePort: 'scenes', target: 'art', targetPort: 'scenes' },
    { id: 'e4', source: 'llm', sourcePort: 'llm', target: 'art', targetPort: 'llm' },
  ],
});

/** One fake model for both nodes: the screenwriter's answer, and a casting answer when the Art Director asks. */
const answering = (director: unknown, casting: unknown = { scenes: [{ block: 'text-card' }, { block: 'hook' }, { block: 'text-card' }] }) => async (prompt: string) => (prompt.startsWith('You are the art director') ? casting : director);

const showcaseParams = {
  prompt: 'Introduce this project to busy developers. Confident, no hype.',
  outputLanguage: 'en',
  beats: [
    { role: 'open', brief: '', weight: 0.5, count: 1, factBindings: {} },
    { role: 'hook', brief: 'What it is.', weight: 1, count: 1, factBindings: { number: 'stars' } },
    { role: 'close', brief: '', weight: 1, count: 1, factBindings: { title: 'name' } },
  ],
};

const goodAnswer = {
  language: 'en',
  scenes: [
    { narration: 'Meet widget, the tiniest way to build widgets for the web.', kicker: 'MEET', title: 'MEET WIDGET' },
    { narration: 'Install it, wire it up, and ship.', title: 'TINY WIDGETS, BIG WEB', number: '1' },
    { narration: 'Star it if it saved you an afternoon.', body: 'ignored, title is bound to name' },
  ],
};

beforeEach(() => {
  _resetNodeRegistry();
  registerNodes();
  registerNodeType(factSource);
});

describe('core/screenwriter', () => {
  it('writes the scenes from a brief and three beats, keeps facts out of the prompt, and the Art Director casts them', async () => {
    const services = makeFakeServices({ complete: answering(goodAnswer) });
    const ex = new Executor(graph(showcaseParams, true), services);
    const { ok } = await ex.run();
    expect(ok).toBe(true);

    const script = ex.runtimes_().get('writer')!.outputs.scenes!.payload as SceneScript;
    expect(script.scenes.map((s) => s.role)).toEqual(['open', 'hook', 'close']);
    expect(script.scenes[1]!.narration).toBe('Install it, wire it up, and ship.');
    const narration = ex.runtimes_().get('writer')!.outputs.script!.payload as { text: string; segments?: string[] };
    expect(narration.segments).toHaveLength(3);
    expect(narration.text.split('\n')).toEqual(narration.segments);
    // The model's value for a bound key is dropped; the assembler fills it from the fact later.
    expect('number' in script.scenes[1]!.content).toBe(false);
    expect(script.scenes[1]!.factBindings).toEqual({ number: 'stars' });

    const plan = ex.runtimes_().get('art')!.outputs.plan!.payload as ScenePlan;
    expect(plan.stage.name).toBe('Dark');
    expect(plan.blocks.map((b) => b.id)).toEqual(['text-card', 'hook']);
    expect(plan.scenes.map((s) => s.blockId)).toEqual(['text-card', 'hook', 'text-card']);
    expect(plan.scenes[0]!.tone).toBe('cool');
    expect(plan.scenes[0]!.fields).toEqual({ kicker: 'MEET' });
    // Bound content becomes a binding on the block's prop that shows it.
    expect(plan.scenes[1]!.factBindings).toEqual({ stars: 'stars' });
    expect('stars' in plan.scenes[1]!.props).toBe(false);
    expect(plan.scenes[2]!.factBindings).toEqual({ headline: 'name' });

    const prompt = services.calls.find((c) => c.name === 'complete')!.args[0] as string;
    expect(prompt).toContain('Introduce this project');
    expect(services.calls.filter((c) => c.name === 'complete').map((c) => String(c.args[0]).startsWith('You are the art director'))).toEqual([false, true]);
    expect(prompt).toContain('Tiny widgets for the web.');
    expect(prompt).not.toContain('4321'); // bound → never shown to the model
    expect(prompt).toContain('github.com/acme/widget'); // not bound → shown
    expect(prompt).not.toContain('An opening line; stars come from data.'); // no block doc in the prompt any more
  });

  it('holds the model to the exact scene count', async () => {
    let calls = 0;
    const services = makeFakeServices({
      complete: async (prompt: string) => {
        if (prompt.startsWith('You are the art director')) return { scenes: [{ block: 'text-card' }, { block: 'hook' }, { block: 'text-card' }] };
        calls++;
        return calls === 1 ? { ...goodAnswer, scenes: goodAnswer.scenes.slice(0, 2) } : goodAnswer;
      },
    });
    const ex = new Executor(graph(showcaseParams, true), services);
    await ex.run();
    expect(calls).toBe(2);
    expect(ex.runtimes_().get('writer')!.state).toBe('success');
  });

  it('works with no facts wired in at all', async () => {
    const services = makeFakeServices({ complete: answering({ language: 'en', scenes: [{ narration: 'a', title: 'A' }, { narration: 'b', title: 'B' }] }, { scenes: [{ block: 'text-card' }, { block: 'text-card' }] }) });
    const params = { ...showcaseParams, beats: [{ role: 'x', brief: '', weight: 1, count: 2, factBindings: {} }] };
    const ex = new Executor(graph(params, false), services);
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    const prompt = services.calls.find((c) => c.name === 'complete')!.args[0] as string;
    expect(prompt).not.toContain('Facts about the subject');
  });

  it('does not run the screenwriter again when only the look changes', async () => {
    const services = makeFakeServices({ complete: answering(goodAnswer) });
    const g = graph(showcaseParams, true);
    const ex = new Executor(g, services);
    await ex.run();
    const lookNodeInGraph = g.nodes.find((n) => n.id === 'art')!;
    lookNodeInGraph.params = { ...lookNodeInGraph.params, tokens: { palette: { bg: '#000000' }, fonts: {} } };
    ex.setGraph(g);
    await ex.run();
    // The screenwriter is not asked again; the Art Director asks the model to cast again (the server answers that from its cache).
    const prompts = services.calls.filter((c) => c.name === 'complete').map((c) => String(c.args[0]));
    expect(prompts.filter((p) => !p.startsWith('You are the art director'))).toHaveLength(1);
    expect(ex.runtimes_().get('writer')!.reused).toBe(true);
    expect(ex.runtimes_().get('art')!.reused).toBe(false);
  });

  it('detects the output language from the brief when asked to', async () => {
    const services = makeFakeServices({ complete: answering({ language: 'vi', scenes: [{ narration: 'Xin chào các bạn.', title: 'Xin chào' }] }, { scenes: [{ block: 'text-card' }] }) });
    const params = { ...showcaseParams, prompt: 'Giới thiệu dự án này cho lập trình viên bận rộn.', outputLanguage: 'auto', beats: [{ role: 'x', brief: '', weight: 1, count: 1, factBindings: {} }] };
    const ex = new Executor(graph(params, false), services);
    await ex.run();
    const prompt = services.calls.find((c) => c.name === 'complete')!.args[0] as string;
    expect(prompt).toContain('Vietnamese');
    expect((ex.runtimes_().get('writer')!.outputs.script!.payload as { language: string }).language).toBe('vi');
  });
});
