import { beforeEach, describe, expect, it } from 'vitest';
import { Executor } from '@/core/engine/executor';
import type { Graph } from '@/core/engine/graph';
import { z } from 'zod';
import { registerNodes } from '@/nodes';
import { _resetNodeRegistry, registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import { makeFakeServices } from '@/core/__tests__/fakes';
import { STYLE, illustratorAnswers, illustratorNode } from '@/core/__tests__/scene-fixtures';
import type { ScenePlan, SceneScript } from '@/core/types/payloads';

/** A pasted script with three kinds of scene: a title, a title with points, and one with nothing on screen. */
const scenes: SceneScript['scenes'] = [
  { role: 'open', weight: 1, narration: 'Xin chào.', content: { title: 'Xin chào', image: '/api/assets/0123456789abcdef0123456789abcdef01234567.png' } },
  { role: 'body', weight: 1, narration: 'Ba bước.', content: { title: 'Ba bước', points: ['một', 'hai', 'ba'] } },
  { role: 'body', weight: 1, narration: 'Sao.', content: { number: '999', label: 'sao' }, factBindings: { number: 'stars' } },
  { role: 'quiet', weight: 1, narration: 'Chỉ có lời.', content: {} },
];
/** A stand-in script node: the Static Script's params carry no factBindings, and the third scene needs one. */
const fakeScript: AnyNodeDefinition = {
  type: 'test/script',
  version: 1,
  kind: 'source',
  inputs: [],
  outputs: [{ name: 'scenes', type: 'SceneScript' }],
  paramsSchema: z.object({}),
  defaultParams: {},
  run: async () => ({ scenes: { language: 'vi', scenes } as SceneScript }),
} as unknown as AnyNodeDefinition;
const graph = (): Graph => ({
  nodes: [
    { id: 'script', type: 'test/script', params: {}, bypassed: false, position: { x: 0, y: 0 } },
    { id: 'llm', type: 'core/llm-provider', params: { providerId: 'claude-code', settings: {} }, bypassed: false, position: { x: 0, y: 0 } },
    illustratorNode('ill', { brief: 'bảng trắng, chữ tròn', frame: '16:9' }),
  ],
  edges: [
    { id: 'e1', source: 'script', sourcePort: 'scenes', target: 'ill', targetPort: 'scenes' },
    { id: 'e2', source: 'llm', sourcePort: 'llm', target: 'ill', targetPort: 'llm' },
  ],
});

beforeEach(() => { _resetNodeRegistry(); registerNodes(); registerNodeType(fakeScript); });

describe('core/illustrator', () => {
  it('draws a style and then one drawing per scene, with the content written in and the bound key marked, and keeps nothing in its params', async () => {
    const services = makeFakeServices({ complete: illustratorAnswers({ ...STYLE, name: 'Bảng trắng' }) });
    const ex = new Executor(graph(), services);
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    const plan = ex.runtime('ill').outputs.plan!.payload as ScenePlan;
    expect(plan.style.name).toBe('Bảng trắng');
    expect(plan.frame).toEqual({ width: 1920, height: 1080 });
    expect(plan.scenes).toHaveLength(4);
    expect(plan.scenes[0]!.source).toContain('Xin chào');
    // The picture went to the model as a token and came back as the file.
    expect(plan.scenes[0]!.source).toContain('<img src="/api/assets/0123456789abcdef0123456789abcdef01234567.png">');
    expect(plan.scenes[1]!.source).toContain('<li>hai</li>');
    expect(plan.scenes[2]!.source).toContain('data-fact="stars"');
    expect(plan.scenes[2]!.factBindings).toEqual({ number: 'stars' });
    expect(plan.scenes[3]!.factBindings).toBeUndefined();
    // One style prompt, then one scene prompt per scene, each carrying its own narration and the style sheet.
    const prompts = services.calls.filter((c) => c.name === 'complete').map((c) => String(c.args[0]));
    expect(prompts.filter((p) => p.includes('Design its style'))).toHaveLength(1);
    const scenePrompts = prompts.filter((p) => p.includes('Draw scene'));
    expect(scenePrompts).toHaveLength(4);
    expect(prompts[0]).toContain('bảng trắng, chữ tròn');
    expect(prompts[0]).toContain('1920×1080 landscape');
    expect(scenePrompts.some((p) => p.includes('"Ba bước."') && p.includes('- points: ["một","hai","ba"]') && p.includes(STYLE.css.split('\n')[1]!))).toBe(true);
    expect(scenePrompts.some((p) => p.includes('data-fact="stars"'))).toBe(true);
    expect(ex.getGraph().nodes.find((n) => n.id === 'ill')!.params).toEqual({ brief: 'bảng trắng, chữ tròn', frame: '16:9', character: '' });
  });

  it('reuses the run when nothing changed, and asks the model afresh on a forced run', async () => {
    const services = makeFakeServices();
    const ex = new Executor(graph(), services);
    await ex.run();
    const before = services.calls.filter((c) => c.name === 'complete').length;
    await ex.run();
    expect(ex.runtime('ill').reused).toBe(true);
    expect(services.calls.filter((c) => c.name === 'complete').length).toBe(before);
    await ex.run({ force: true });
    expect(ex.runtime('ill').reused).toBe(false);
    expect(services.calls.filter((c) => c.name === 'complete').length).toBe(before * 2);
  });

  it('puts the character picture into the plan as a var and asks every scene to draw it', async () => {
    const g = graph();
    (g.nodes[2]!.params as { character: string }).character = '/api/assets/0123456789abcdef.png';
    const services = makeFakeServices();
    const ex = new Executor(g, services);
    await ex.run();
    const plan = ex.runtime('ill').outputs.plan!.payload as ScenePlan;
    expect(plan.vars).toEqual({ character: '/api/assets/0123456789abcdef.png' });
    const scenePrompts = services.calls.filter((c) => c.name === 'complete' && String(c.args[0]).includes('Draw scene'));
    expect(scenePrompts.every((c) => String(c.args[0]).includes('<img data-var="character">'))).toBe(true);
    expect(plan.scenes.every((s) => s.source.includes('data-var="character"'))).toBe(true);
  });

  it('asks once more with the reason when a drawing breaks a rule, and fails after the second', async () => {
    let asked = 0;
    const services = makeFakeServices({
      complete: illustratorAnswers(STYLE, async () => undefined),
    });
    const base = services.complete.bind(services);
    services.complete = async (ref, prompt, schema, signal, opts) => {
      if (prompt.includes('Draw scene 3')) {
        asked++;
        return schema.parse({ source: asked === 1 ? '<html><body>x</body></html>' : '<div data-fact="stars">999</div>' });
      }
      return base(ref, prompt, schema, signal, opts);
    };
    const ex = new Executor(graph(), services);
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    expect(asked).toBe(2);

    const stubborn = makeFakeServices();
    const base2 = stubborn.complete.bind(stubborn);
    stubborn.complete = async (ref, prompt, schema, signal, opts) => (prompt.includes('Draw scene 3') ? schema.parse({ source: '<div>no fact here</div>' }) : base2(ref, prompt, schema, signal, opts));
    const ex2 = new Executor(graph(), stubborn);
    await ex2.run();
    expect(ex2.runtime('ill').state).toBe('error');
    expect(ex2.runtime('ill').error?.message).toContain('data-fact="stars"');
  });
});
