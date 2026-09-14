import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Executor } from '@/core/engine/executor';
import { pinNode, type Graph } from '@/core/engine/graph';
import { registerNodes } from '@/nodes';
import { registerForms } from '@/forms';
import { _resetNodeRegistry, registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import { makeFakeServices } from '@/contracts/__tests__/fakes';
import { illustratorAnswers } from '@/contracts/__tests__/scene-fixtures';
import type { LayerSheet, LayerSpec, ScenePlan, SceneScript, StyleSheet } from '@/contracts/types/payloads';

/**
 * The Set (CORE_CONTRACTS §5.22): everything about a film that does not change, drawn once.
 *
 * It was two nodes until 2026-09-12. These hold the promises both of them made — the band is data,
 * the ground follows what is under the scenes, a member keeps its own name — plus the one the merge
 * adds: one run draws both, and the Illustrator wired to it asks the model nothing about style.
 */

const scenes: SceneScript['scenes'] = [
  { role: 'open', weight: 1, narration: 'Xin chào.', content: { title: 'Xin chào' } },
  { role: 'body', weight: 1, narration: 'Ba bước.', content: { title: 'Ba bước' } },
];
const scriptNode = (form?: string): AnyNodeDefinition => ({
  type: 'test/script', version: 1, kind: 'source', inputs: [], outputs: [{ name: 'scenes', type: 'SceneScript' }],
  paramsSchema: z.object({}), defaultParams: {},
  run: async () => ({ scenes: { language: 'vi', scenes, ...(form ? { form } : {}) } as SceneScript }),
} as unknown as AnyNodeDefinition);

const PHONE = { id: 'phone', brief: 'một chiếc điện thoại nghiêng', placement: 'over' as const, width: 0, height: 0, source: '' };
const SOLID = { id: 'solid', brief: 'một khối 3D quay', placement: 'under' as const, width: 720, height: 720, source: '' };

const node = (id: string, type: string, params: Record<string, unknown>) => ({ id, type, params, bypassed: false, position: { x: 0, y: 0 } });
const graph = (params: Record<string, unknown> = {}, wire = true): Graph => ({
  nodes: [
    node('script', 'test/script', {}),
    node('set', 'core/set', { llmProvider: 'claude-code', brief: 'nền kem, chữ tròn', frame: '9:16', character: '', ground: 'solid', form: '', members: [], ...params }),
    // Downstream only so the set's ports have somewhere to go; what it does is not what is tested.
    node('ill', 'core/plates', { llmProvider: 'claude-code', llmSettings: {}, redraw: false }),
  ],
  edges: [
    // Nothing reaches the set: it has no inputs. The script is here for the Illustrator only.
    { id: 'e2', source: 'script', sourcePort: 'scenes', target: 'ill', targetPort: 'scenes' },
    ...(wire ? [{ id: 'e3', source: 'set', sourcePort: 'style', target: 'ill', targetPort: 'style' }, { id: 'e4', source: 'set', sourcePort: 'layers', target: 'ill', targetPort: 'layers' }] : []),
  ],
});

const run = async (params: Record<string, unknown> = {}, wire = true) => {
  const services = makeFakeServices({ complete: illustratorAnswers() });
  const ex = new Executor(graph(params, wire), services);
  const { ok } = await ex.run();
  return { ex, services, ok };
};
const stylePrompts = (s: ReturnType<typeof makeFakeServices>) => s.calls.filter((c) => c.name === 'complete' && String(c.args[0]).includes('Design its style'));
const thingPrompts = (s: ReturnType<typeof makeFakeServices>) => s.calls.filter((c) => c.name === 'complete' && String(c.args[0]).includes('Draw ONE thing'));

beforeEach(() => { _resetNodeRegistry(); registerNodes(); registerForms(); registerNodeType(scriptNode()); });

describe('the set', () => {
  it('draws one sheet and says what it was designed for', async () => {
    const { ex, services, ok } = await run();
    expect(ok, JSON.stringify(ex.runtime('set').error)).toBe(true);
    const sheet = ex.runtime('set').outputs.style!.payload as StyleSheet;
    expect(sheet.frame).toEqual({ width: 1080, height: 1920 });
    expect(sheet.transparent).toBe(false);
    expect(sheet.style.captions, 'the caption band is data, not a rule in the sheet').toBeTruthy();
    expect(String(stylePrompts(services)[0]!.args[0])).toContain('nền kem, chữ tròn');
  });

  it('draws to the form it is set to, and refuses one this build does not ship', async () => {
    // The form used to be taken off the script wired in. Nothing is wired in now: a set belongs to
    // the channel, and reading one film's script made it belong to that film instead.
    const { services } = await run({ form: 'kinetic-type' });
    expect(String(stylePrompts(services)[0]!.args[0])).toContain("This film's form");

    const bad = await run({ form: 'nonsense' });
    expect(bad.ex.runtime('set').state).toBe('error');
    expect(bad.ex.runtime('set').error?.message).toContain('nonsense');
  });

  it('drops the scenes\' ground by itself when a member is under them', async () => {
    const { ex } = await run({ members: [SOLID] });
    expect((ex.runtime('set').outputs.style!.payload as StyleSheet).transparent).toBe(true);
  });

  it('draws the members that need drawing and passes on the ones given a size', async () => {
    const { ex, services } = await run({ members: [PHONE, SOLID] });
    const cast = ex.runtime('set').outputs.layers!.payload as LayerSheet;
    // Everything this node makes is a code layer: it draws, it does not choose files.
    const drawn = cast.layers.filter((l): l is Extract<LayerSpec, { kind: 'code' }> => l.kind === 'code');
    expect(drawn.map((m) => m.id)).toEqual(['phone', 'solid']);
    expect(drawn[0]!.source.length).toBeGreaterThan(0);
    expect(drawn[1]!.width).toBe(720);
    const asks = thingPrompts(services);
    expect(asks, 'it drew the member it was handed a size for').toHaveLength(1);
    expect(String(asks[0]!.args[0])).toContain('stage.phone');
  });

  it('refuses two members with one name, because the scenes address them by it', async () => {
    const { ex } = await run({ members: [PHONE, { ...SOLID, id: 'phone' }] });
    expect(ex.runtime('set').state).toBe('error');
    expect(ex.runtime('set').error?.message).toContain('phone');
  });
});

describe('what the rest of the film does with it', () => {
  it('draws the one style the rest of the film is drawn against', async () => {
    // The Illustrator drew a style of its own until 2026-09-13, and a set wired in silenced it.
    // There is one place a style comes from now, so there is nothing left to silence.
    const { services } = await run();
    expect(stylePrompts(services)).toHaveLength(1);
  });

  it('tells the plate maker what room to leave, by name and by size', async () => {
    const { services } = await run({ members: [PHONE, SOLID] });
    const platePrompts = services.calls.filter((c) => c.name === 'complete' && String(c.args[0]).includes('Draw ONE layout')).map((c) => String(c.args[0]));
    expect(platePrompts.length).toBeGreaterThan(0);
    // Only what sits over the scenes: a layer underneath takes no room from the words.
    for (const p of platePrompts) {
      expect(p).toContain('"phone"');
      expect(p).not.toContain('"solid"');
    }
  });

  it('asks the model nothing at all once it is pinned', async () => {
    const first = await run({ members: [PHONE] });
    const pinned = pinNode(first.ex.getGraph(), 'set', first.ex.runtime('set').outputs, new Date().toISOString());
    const services = makeFakeServices({ complete: illustratorAnswers() });
    const ex = new Executor(pinned, services);
    await ex.run();
    expect(stylePrompts(services)).toHaveLength(0);
    expect(thingPrompts(services)).toHaveLength(0);
  });
});
