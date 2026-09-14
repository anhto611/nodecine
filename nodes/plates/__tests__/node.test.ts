import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Executor } from '@/core/engine/executor';
import { pinNode, type Graph } from '@/core/engine/graph';
import { registerNodes } from '@/nodes';
import { registerForms } from '@/forms';
import { _resetNodeRegistry, registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import { makeFakeServices } from '@/contracts/__tests__/fakes';
import { illustratorAnswers, STYLE } from '@/contracts/__tests__/scene-fixtures';
import type { PlateSheet, ScenePlan, SceneScript } from '@/contracts/types/payloads';

/**
 * Plates end to end: drawn once per shape, then poured into without a model.
 *
 * The two numbers this is here to hold: how many times the model is asked, and whether two runs of
 * one script give the same frames. The Illustrator could promise neither.
 */

const scenes: SceneScript['scenes'] = [
  { role: 'open', weight: 1, narration: 'Ba bước.', content: { title: 'Ba bước', points: ['một', 'hai', 'ba'] } },
  { role: 'body', weight: 1, narration: 'Hai bước.', content: { title: 'Hai bước', points: ['a', 'b'] } },
  { role: 'body', weight: 1, narration: 'Số liệu.', content: { number: '1.240', label: 'khách mới' } },
];
const scriptNode: AnyNodeDefinition = {
  type: 'test/script', version: 1, kind: 'source', inputs: [], outputs: [{ name: 'scenes', type: 'SceneScript' }],
  paramsSchema: z.object({}), defaultParams: {},
  run: async () => ({ scenes: { language: 'vi', scenes } as SceneScript }),
} as unknown as AnyNodeDefinition;

/** A plate the fake model draws: a hole per key, and one row for a list. */
const plateAnswer = (prompt: string) => {
  const keys = /The shape is these content keys, and only these: ([^.]+)\./.exec(prompt)![1]!.split(', ');
  const hole = (k: string) => (k === 'points' || k === 'entries'
    ? `<ul data-slot="${k}"><li data-item>ý</li></ul>`
    : `<div data-slot="${k}">…</div>`);
  return { source: `<div class="card">${keys.map(hole).join('')}</div>`, budget: Object.fromEntries(keys.map((k) => [k, 80])) };
};

const node = (id: string, type: string, params: Record<string, unknown>) => ({ id, type, params, bypassed: false, position: { x: 0, y: 0 } });
const graph = (): Graph => ({
  nodes: [
    node('script', 'test/script', {}),
    node('set', 'core/set', { llmProvider: 'claude-code', brief: 'nền kem', frame: '9:16', character: '', ground: 'solid', form: '', members: [] }),
    node('plates', 'core/plates', { llmProvider: 'claude-code', redraw: false }),
    node('build', 'core/compose', { transition: 'fade', transitionSeconds: 0.4 }),
  ],
  edges: [
    { id: 'e1', source: 'script', sourcePort: 'scenes', target: 'set', targetPort: 'scenes' },
    { id: 'e2', source: 'script', sourcePort: 'scenes', target: 'plates', targetPort: 'scenes' },
    { id: 'e3', source: 'set', sourcePort: 'style', target: 'plates', targetPort: 'style' },
    { id: 'e4', source: 'script', sourcePort: 'scenes', target: 'build', targetPort: 'scenes' },
    { id: 'e5', source: 'set', sourcePort: 'style', target: 'build', targetPort: 'style' },
    { id: 'e6', source: 'plates', sourcePort: 'plates', target: 'build', targetPort: 'plates' },
  ],
});

/**
 * The shared fixture answers the plate prompt too, so a test that wants a particular plate — or a
 * bad one — has to get in front of it rather than behind it.
 */
const answering = (plate: (prompt: string) => unknown) => {
  const rest = illustratorAnswers(STYLE);
  return async (prompt: string) => (prompt.includes('Draw ONE layout') ? plate(prompt) : rest(prompt));
};
const services = () => makeFakeServices({ complete: answering(plateAnswer) });
const plateAsks = (s: ReturnType<typeof services>) => s.calls.filter((c) => c.name === 'complete' && String(c.args[0]).includes('Draw ONE layout'));

beforeEach(() => { _resetNodeRegistry(); registerNodes(); registerForms(); registerNodeType(scriptNode); });

describe('the plate maker', () => {
  it('draws one plate per shape, not one per scene', async () => {
    const fake = services();
    const ex = new Executor(graph(), fake);
    const { ok } = await ex.run();
    expect(ok, JSON.stringify(ex.runtime('plates').error)).toBe(true);
    const sheet = ex.runtime('plates').outputs.plates!.payload as PlateSheet;
    // Three scenes, two shapes: the two lists share a plate.
    expect(sheet.plates.map((p) => p.id).sort()).toEqual(['number_label', 'title_points']);
    expect(plateAsks(fake)).toHaveLength(2);
    expect(sheet.plates.find((p) => p.id === 'title_points')!.budget).toBeTruthy();
  });

  it('asks for nothing it already holds', async () => {
    const first = new Executor(graph(), services());
    await first.run();
    const pinned = pinNode(first.getGraph(), 'plates', first.runtime('plates').outputs, new Date().toISOString());
    const fake = services();
    const ex = new Executor(pinned, fake);
    await ex.run();
    expect(plateAsks(fake), 'a pinned sheet was drawn again').toHaveLength(0);
  });

  it('refuses a plate with no hole for a key it was asked for', async () => {
    const fake = makeFakeServices({ complete: answering(() => ({ source: '<div class="card">chữ cứng</div>' })) });
    const ex = new Executor(graph(), fake);
    await ex.run();
    expect(ex.runtime('plates').state).toBe('error');
    expect(ex.runtime('plates').error?.message).toMatch(/no hole for/);
  });
});

describe('the scene builder', () => {
  it('fills every scene without asking the model anything', async () => {
    const fake = services();
    const ex = new Executor(graph(), fake);
    await ex.run();
    const plan = ex.runtime('build').outputs.plan!.payload as ScenePlan;
    expect(plan.scenes).toHaveLength(3);
    expect(plan.scenes[0]!.source).toContain('Ba bước');
    expect(plan.scenes[0]!.source.split('<li data-item>').length - 1).toBe(3);
    expect(plan.scenes[2]!.source).toContain('1.240');
    // Two shapes were drawn; nothing was asked after that.
    expect(plateAsks(fake)).toHaveLength(2);
  });

  it('gives the same frames twice, which the Illustrator never could', async () => {
    const a = new Executor(graph(), services());
    await a.run();
    const b = new Executor(graph(), services());
    await b.run();
    const sources = (ex: Executor) => (ex.runtime('build').outputs.plan!.payload as ScenePlan).scenes.map((s) => s.source);
    expect(sources(b)).toEqual(sources(a));
  });

  it('stops by name when the script says a shape nobody drew', async () => {
    const fake = services();
    const first = new Executor(graph(), fake);
    await first.run();
    // Pin the sheet, then ask for a scene of a shape it does not hold.
    const g = pinNode(first.getGraph(), 'plates', first.runtime('plates').outputs, new Date().toISOString());
    registerNodeType({ ...scriptNode, run: async () => ({ scenes: { language: 'vi', scenes: [{ role: 'x', weight: 1, narration: 'n', content: { quote: 'câu', attribution: 'ai đó' } }] } }) } as unknown as AnyNodeDefinition);
    const ex = new Executor(g, services());
    await ex.run();
    expect(ex.runtime('build').state).toBe('error');
    expect(ex.runtime('build').error?.message).toContain('quote+attribution');
    expect(ex.runtime('build').error?.fix).toContain('plate maker');
  });
});
