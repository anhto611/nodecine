import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Executor } from '@/core/engine/executor';
import type { Graph } from '@/core/engine/graph';
import { registerNodes } from '@/nodes';
import { _resetNodeRegistry, registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import { SCENE_BREAKDOWN } from '@/nodes/breakdown/node';
import { makeFakeServices } from '@/contracts/__tests__/fakes';
import type { SceneScript } from '@/contracts/types/payloads';

/**
 * A pasted script, cut into scenes with nothing on screen but one the person wrote by hand and one
 * with a picture, then the breakdown after it.
 */

const IMAGE = '/api/assets/0123456789abcdef.png';
const pasted: SceneScript = {
  language: 'vi',
  scenes: [
    { role: 'open', weight: 1, narration: 'Mỗi cảnh là một tấm hình.', content: {} },
    { role: 'body', weight: 1, narration: 'Ba bước: chọn, nối, chạy.', content: { title: 'Ba bước', points: ['chọn', 'nối', 'chạy'] } },
    { role: 'close', weight: 1, narration: 'Bấm chạy là xong.', content: { image: IMAGE } },
  ],
};

let scenesIn: SceneScript = pasted;
const scriptSource: AnyNodeDefinition = {
  type: 'test/scenes', version: 1, kind: 'source', inputs: [],
  outputs: [{ name: 'scenes', type: 'SceneScript' }],
  paramsSchema: z.object({}), defaultParams: {},
  run: async () => ({ scenes: scenesIn }),
} as unknown as AnyNodeDefinition;

const graph = (params: Record<string, unknown> = {}): Graph => ({
  nodes: [
    { id: 'src', type: 'test/scenes', params: {}, bypassed: false, position: { x: 0, y: 0 } },
    { id: 'cut', type: SCENE_BREAKDOWN, params: { llmProvider: 'claude-code', ...params }, bypassed: false, position: { x: 0, y: 0 } },
  ],
  edges: [
    { id: 'e1', source: 'src', sourcePort: 'scenes', target: 'cut', targetPort: 'scenes' },
  ],
});

const answer = {
  language: 'vi',
  scenes: [
    { kicker: 'Mở', title: 'Một cảnh, một tấm hình' },
    {},
    { title: 'Bấm chạy', body: '', points: [] },
  ],
};

const run = async (services: ReturnType<typeof makeFakeServices>, params?: Record<string, unknown>) => {
  const ex = new Executor(graph(params), services);
  const { ok } = await ex.run();
  return { ok, out: ex.runtimes_().get('cut')!.outputs.scenes?.payload as SceneScript | undefined, state: ex.runtimes_().get('cut')!.state };
};

beforeEach(() => {
  _resetNodeRegistry();
  registerNodes();
  registerNodeType(scriptSource);
  scenesIn = pasted;
});

describe('core/scene-breakdown', () => {
  it('writes the empty scenes, keeps the hand-written one and the picture, and never touches the narration', async () => {
    const services = makeFakeServices({ complete: async () => answer });
    const { ok, out } = await run(services);
    expect(ok).toBe(true);
    expect(out!.language).toBe('vi');
    expect(out!.scenes.map((s) => s.narration)).toEqual(pasted.scenes.map((s) => s.narration));
    expect(out!.scenes.map((s) => s.role)).toEqual(['open', 'body', 'close']);
    expect(out!.scenes[0]!.content).toEqual({ kicker: 'Mở', title: 'Một cảnh, một tấm hình' });
    // The person's words outrank the model's, and the model was told so.
    expect(out!.scenes[1]!.content).toEqual({ title: 'Ba bước', points: ['chọn', 'nối', 'chạy'] });
    // The picture stays, and an empty value is no value.
    expect(out!.scenes[2]!.content).toEqual({ title: 'Bấm chạy', image: IMAGE });

    const prompt = services.calls.find((c) => c.name === 'complete')!.args[0] as string;
    expect(prompt).toContain('Ba bước: chọn, nối, chạy." — already written by hand');
    expect(prompt).toContain('Vietnamese');
  });

  it('rewrites every scene when told to', async () => {
    const services = makeFakeServices({ complete: async () => ({ ...answer, scenes: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] }) });
    const { out } = await run(services, { overwrite: true });
    expect(out!.scenes.map((s) => s.content.title)).toEqual(['A', 'B', 'C']);
    expect(out!.scenes[2]!.content.image).toBe(IMAGE);
    const prompt = services.calls.find((c) => c.name === 'complete')!.args[0] as string;
    expect(prompt).not.toContain('keep');
  });

  it('does not ask the model when every scene already has something on screen', async () => {
    scenesIn = { ...pasted, scenes: pasted.scenes.map((s) => ({ ...s, content: { ...s.content, title: 't' } })) };
    const services = makeFakeServices({ complete: async () => { throw new Error('should not be called'); } });
    const { ok, out } = await run(services);
    expect(ok).toBe(true);
    expect(out).toEqual(scenesIn);
    expect(services.calls.some((c) => c.name === 'complete')).toBe(false);
  });

  it('leaves a bound key to the fact that fills it later', async () => {
    scenesIn = { language: 'en', scenes: [{ role: 'x', weight: 1, narration: 'Four thousand stars.', content: {}, factBindings: { number: 'stars' } }] };
    const services = makeFakeServices({ complete: async () => ({ language: 'en', scenes: [{ number: '4000', label: 'stars' }] }) });
    const { out } = await run(services);
    expect(out!.scenes[0]!.content).toEqual({ label: 'stars' });
    expect(out!.scenes[0]!.factBindings).toEqual({ number: 'stars' });
  });

  it('holds the model to the exact scene count', async () => {
    let calls = 0;
    const services = makeFakeServices({ complete: async () => (++calls === 1 ? { ...answer, scenes: answer.scenes.slice(0, 2) } : answer) });
    const { state } = await run(services);
    expect(calls).toBe(2);
    expect(state).toBe('success');
  });

  it('holds the model to the language of the script', async () => {
    let calls = 0;
    const services = makeFakeServices({ complete: async () => (++calls === 1 ? { ...answer, language: 'en' } : answer) });
    const { state } = await run(services);
    expect(calls).toBe(2);
    expect(state).toBe('success');
  });
});
