import { describe, expect, it } from 'vitest';
import { boundFactKeys, expandBeats, outputSchemaFor, sceneSchemaFor, toPackets, type Beat } from '@/nodes/director/beats';
import { SceneScriptSchema } from '@/core/types/payloads';

const beat = (over: Partial<Beat> = {}): Beat => ({ role: 'beat', brief: '', weight: 1, count: 1, factBindings: {}, ...over });

describe('expandBeats', () => {
  it('unrolls each beat by its count, in order, carrying weight and bindings', () => {
    const scenes = expandBeats([beat({ role: 'open', weight: 0.5 }), beat({ role: 'body', count: 3, factBindings: { number: 'stars' } })]);
    expect(scenes.map((s) => s.role)).toEqual(['open', 'body', 'body', 'body']);
    expect(scenes[0]!.weight).toBe(0.5);
    expect(scenes[1]!.factBindings).toEqual({ number: 'stars' });
  });
});

describe('sceneSchemaFor / outputSchemaFor', () => {
  it('accepts the content vocabulary, drops unknown keys and never asks for a bound key', () => {
    const [scene] = expandBeats([beat({ factBindings: { number: 'stars' } })]);
    const schema = sceneSchemaFor(scene!);
    const parsed = schema.parse({ title: 'A', body: 'B', number: '4,321', block: 'hook' });
    expect(parsed).toEqual({ title: 'A', body: 'B' });
    expect(schema.safeParse({ points: ['a', 'b'] }).success).toBe(true);
    expect(schema.safeParse({ points: 'not a list' }).success).toBe(false);
  });

  it('demands exactly one scene per expanded beat, in order', () => {
    const scenes = expandBeats([beat(), beat({ count: 2 })]);
    const schema = outputSchemaFor(scenes);
    const good = { language: 'en', audioScript: 'A narration long enough to count as one.', scenes: [{ title: 'T' }, { title: 'A' }, { title: 'B' }] };
    expect(schema.safeParse(good).success).toBe(true);
    expect(schema.safeParse({ ...good, scenes: good.scenes.slice(0, 2) }).success).toBe(false);
    expect(schema.safeParse({ ...good, scenes: [...good.scenes, { title: 'extra' }] }).success).toBe(false);
  });

  it('refuses an empty beat list', () => {
    expect(() => outputSchemaFor([])).toThrow();
  });
});

describe('boundFactKeys', () => {
  it('collects the fact keys the assembler will read', () => {
    expect([...boundFactKeys([beat({ factBindings: { number: 'stars', title: 'name' } }), beat({ factBindings: { number: 'stars' } })])].sort()).toEqual(['name', 'stars']);
  });
});

describe('toPackets', () => {
  it('builds a scene script whose scenes carry the beat role, weight and bindings, and the model\'s content', () => {
    const scenes = expandBeats([beat({ role: 'open', weight: 0.5 }), beat({ role: 'proof', count: 2, factBindings: { number: 'stars' } })]);
    const { scenes: script, script: narration } = toPackets({
      language: 'EN',
      audioScript: '  Hello there.  ',
      scenes: [{ kicker: 'HI', title: 'T' }, { title: 'A', label: 'stars' }, { title: 'B' }],
    }, scenes);
    expect(SceneScriptSchema.safeParse(script).success).toBe(true);
    expect(script.language).toBe('en');
    expect(narration.text).toBe('Hello there.');
    expect(script.scenes.map((s) => s.role)).toEqual(['open', 'proof', 'proof']);
    expect(script.scenes.map((s) => s.weight)).toEqual([0.5, 1, 1]);
    expect(script.scenes[0]!.content).toEqual({ kicker: 'HI', title: 'T' });
    expect(script.scenes[0]!.factBindings).toBeUndefined();
    expect(script.scenes[1]!.factBindings).toEqual({ number: 'stars' });
  });
});
