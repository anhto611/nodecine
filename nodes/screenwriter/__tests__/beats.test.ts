import { describe, expect, it } from 'vitest';
import { boundFactKeys, expandBeats, outputSchemaFor, sceneSchemaFor, toPackets, type Beat } from '@/nodes/screenwriter/beats';
import { SceneScriptSchema } from '@/contracts/types/payloads';

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
    const parsed = schema.parse({ narration: 'Say this.', title: 'A', body: 'B', number: '4,321', legacyLayout: 'hook' });
    expect(parsed).toEqual({ narration: 'Say this.', title: 'A', body: 'B' });
    expect(schema.safeParse({ narration: 'n', points: ['a', 'b'] }).success).toBe(true);
    expect(schema.safeParse({ narration: 'n', points: 'not a list' }).success).toBe(false);
    expect(schema.safeParse({ title: 'silent' }).success).toBe(false); // every scene speaks
  });

  it('demands exactly one scene per expanded beat, in order', () => {
    const scenes = expandBeats([beat(), beat({ count: 2 })]);
    const schema = outputSchemaFor(scenes);
    const good = { language: 'en', scenes: [{ narration: 'one', title: 'T' }, { narration: 'two', title: 'A' }, { narration: 'three', title: 'B' }] };
    expect(schema.safeParse(good).success).toBe(true);
    expect(schema.safeParse({ ...good, scenes: good.scenes.slice(0, 2) }).success).toBe(false);
    expect(schema.safeParse({ ...good, scenes: [...good.scenes, { narration: 'x', title: 'extra' }] }).success).toBe(false);
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
      scenes: [{ narration: ' Hello there. ', kicker: 'HI', title: 'T' }, { narration: 'Stars.', title: 'A', label: 'stars' }, { narration: 'Bye.', title: 'B' }],
    }, scenes);
    expect(SceneScriptSchema.safeParse(script).success).toBe(true);
    expect(script.language).toBe('en');
    // The voice-over is the narrations in order, and it keeps them apart so the TTS Engine can voice each one.
    expect(narration.text).toBe('Hello there.\nStars.\nBye.');
    expect(narration.segments).toEqual(['Hello there.', 'Stars.', 'Bye.']);
    expect(script.scenes.map((s) => s.narration)).toEqual(['Hello there.', 'Stars.', 'Bye.']);
    expect(script.scenes.map((s) => s.role)).toEqual(['open', 'proof', 'proof']);
    expect(script.scenes.map((s) => s.weight)).toEqual([0.5, 1, 1]);
    expect(script.scenes[0]!.content).toEqual({ kicker: 'HI', title: 'T' }); // narration is not content
    expect(script.scenes[0]!.factBindings).toBeUndefined();
    expect(script.scenes[1]!.factBindings).toEqual({ number: 'stars' });
  });
});
