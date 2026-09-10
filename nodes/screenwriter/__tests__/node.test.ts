import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Executor } from '@/core/engine/executor';
import type { Graph } from '@/core/engine/graph';
import { registerNodes } from '@/nodes';
import { _resetNodeRegistry, registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import { SCREENWRITER } from '@/nodes/screenwriter/node';
import { makeFakeServices } from '@/core/__tests__/fakes';
import type { SceneScript } from '@/core/types/payloads';

/**
 * The GitHub showcase's writing step, rebuilt from parts a user can reach: a fact source and the
 * Screenwriter with a brief and three beats, one of them with the star count bound to a fact.
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

const writer = (params: Record<string, unknown>) => ({ id: 'writer', type: SCREENWRITER, params, bypassed: false, position: { x: 0, y: 0 } });
const llm = { id: 'llm', type: 'core/llm-provider', params: { providerId: 'claude-code', settings: {} }, bypassed: false, position: { x: 0, y: 0 } };
const factsNode = { id: 'facts', type: 'test/facts', params: {}, bypassed: false, position: { x: 0, y: 0 } };
const graph = (params: Record<string, unknown>, withFacts: boolean): Graph => ({
  nodes: [...(withFacts ? [factsNode] : []), llm, writer(params)],
  edges: [
    { id: 'e1', source: 'llm', sourcePort: 'llm', target: 'writer', targetPort: 'llm' },
    ...(withFacts ? [{ id: 'e2', source: 'facts', sourcePort: 'facts', target: 'writer', targetPort: 'facts' }] : []),
  ],
});

/** The fake model's answer to the screenwriter. */
const answering = (script: unknown) => async () => script;

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
  it('writes scenes from a brief and three beats while keeping bound facts out of the prompt', async () => {
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

    const prompt = services.calls.find((c) => c.name === 'complete')!.args[0] as string;
    expect(prompt).toContain('Introduce this project');
    expect(prompt).toContain('Tiny widgets for the web.');
    expect(prompt).not.toContain('4321'); // bound → never shown to the model
    expect(prompt).toContain('github.com/acme/widget'); // not bound → shown
    expect(prompt).not.toContain('An opening line; stars come from data.'); // no renderer documentation in this prompt
  });

  it('holds the model to the exact scene count', async () => {
    let calls = 0;
    const services = makeFakeServices({
      complete: async (prompt: string) => {
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
    const services = makeFakeServices({ complete: answering({ language: 'en', scenes: [{ narration: 'a', title: 'A' }, { narration: 'b', title: 'B' }] }) });
    const params = { ...showcaseParams, beats: [{ role: 'x', brief: '', weight: 1, count: 2, factBindings: {} }] };
    const ex = new Executor(graph(params, false), services);
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    const prompt = services.calls.find((c) => c.name === 'complete')!.args[0] as string;
    expect(prompt).not.toContain('Facts about the subject');
  });


  it('detects the output language from the brief when asked to', async () => {
    const services = makeFakeServices({ complete: answering({ language: 'vi', scenes: [{ narration: 'Xin chào các bạn.', title: 'Xin chào' }] }) });
    const params = { ...showcaseParams, prompt: 'Giới thiệu dự án này cho lập trình viên bận rộn.', outputLanguage: 'auto', beats: [{ role: 'x', brief: '', weight: 1, count: 1, factBindings: {} }] };
    const ex = new Executor(graph(params, false), services);
    await ex.run();
    const prompt = services.calls.find((c) => c.name === 'complete')!.args[0] as string;
    expect(prompt).toContain('Vietnamese');
    expect((ex.runtimes_().get('writer')!.outputs.script!.payload as { language: string }).language).toBe('vi');
  });
});
