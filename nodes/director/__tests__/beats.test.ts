import { describe, expect, it } from 'vitest';
import { boundFactKeys, expandBeats, outputSchemaFor, sceneSchemaFor, toPackets, unknownBlocks, type Beat } from '@/nodes/director/beats';
import { propsSchemaFor } from '@/core/look/props';
import { DirectorPlanSchema } from '@/core/types/payloads';
import { CARD, HOOK, STAGE, TEXT_CARD } from '@/core/__tests__/look-fixtures';

const catalogue = [TEXT_CARD, HOOK, CARD];
const beat = (over: Partial<Beat> = {}): Beat => ({ role: 'beat', brief: '', weight: 1, count: 1, blocks: [], factBindings: {}, ...over });

describe('expandBeats', () => {
  it('unrolls each beat by its count, in order, resolving its allowed blocks', () => {
    const scenes = expandBeats([beat({ role: 'open', weight: 0.5, blocks: ['text-card'] }), beat({ role: 'body', count: 3, factBindings: { stars: 'stars' } })], catalogue);
    expect(scenes.map((s) => s.role)).toEqual(['open', 'body', 'body', 'body']);
    expect(scenes[0]!.allowed.map((b) => b.id)).toEqual(['text-card']);
    expect(scenes[1]!.allowed.map((b) => b.id)).toEqual(['text-card', 'hook', 'card']); // empty list = every wired block
    expect(scenes[0]!.weight).toBe(0.5);
    expect(scenes[1]!.factBindings).toEqual({ stars: 'stars' });
  });
});

describe('props schemas from a block', () => {
  it('leaves fact-bound props out of what the model must write', () => {
    const schema = propsSchemaFor(CARD, ['stars']);
    expect(schema.safeParse({ headline: 'HI', features: ['a', 'b', 'c'], mood: 'calm', accentColor: '#112233' }).success).toBe(true);
    // A bound field the model wrote anyway is dropped rather than rejected.
    const parsed = schema.parse({ headline: 'HI', features: ['a', 'b', 'c'], mood: 'calm', accentColor: '#112233', stars: 999 });
    expect('stars' in parsed).toBe(false);
  });

  it('strips fields the model invents and holds the ones it declares', () => {
    const schema = propsSchemaFor(CARD);
    const parsed = schema.parse({ headline: 'HI', features: ['a', 'b', 'c'], mood: 'calm', accentColor: '#112233', url: 'evil' });
    expect('url' in parsed).toBe(false);
    expect(schema.safeParse({ headline: 'HI', features: ['a', 'b'], mood: 'calm', accentColor: '#112233' }).success).toBe(false);
    expect(schema.safeParse({ headline: 'HI', features: ['a', 'b', 'c'], mood: 'calm', accentColor: 'red' }).success).toBe(false);
  });

  it('an optional field takes null, which is what a missing fact binds to', () => {
    expect(propsSchemaFor(HOOK).safeParse({ headline: 'A', stars: null }).success).toBe(true);
  });
});

describe('sceneSchemaFor / outputSchemaFor', () => {
  it('lets the model choose among the allowed blocks, and only those', () => {
    const [scene] = expandBeats([beat({ blocks: ['text-card', 'hook'] })], catalogue);
    const schema = sceneSchemaFor(scene!, STAGE);
    expect(schema.safeParse({ block: 'hook', props: { headline: 'A' } }).success).toBe(true);
    expect(schema.safeParse({ block: 'text-card', props: { headline: 'A' } }).success).toBe(true);
    expect(schema.safeParse({ block: 'card', props: { headline: 'A' } }).success).toBe(false);
  });

  it('demands exactly one scene per expanded beat, in order', () => {
    const scenes = expandBeats([beat({ blocks: ['text-card'] }), beat({ count: 2, blocks: ['hook'] })], catalogue);
    const schema = outputSchemaFor(scenes, STAGE);
    const good = { language: 'en', audioScript: 'A narration long enough to count as one.', scenes: [{ block: 'text-card', props: { headline: 'T' } }, { block: 'hook', props: { headline: 'A' } }, { block: 'hook', props: { headline: 'B' } }] };
    expect(schema.safeParse(good).success).toBe(true);
    expect(schema.safeParse({ ...good, scenes: good.scenes.slice(0, 2) }).success).toBe(false);
    expect(schema.safeParse({ ...good, scenes: [...good.scenes, { block: 'hook', props: { headline: 'extra' } }] }).success).toBe(false);
  });

  it('refuses an empty beat list and a beat with no block to choose from', () => {
    expect(() => outputSchemaFor([], STAGE)).toThrow();
    expect(() => outputSchemaFor(expandBeats([beat({ blocks: ['ghost'] })], catalogue), STAGE)).toThrow(/no block/);
  });
});

describe('unknownBlocks / boundFactKeys', () => {
  it('names blocks the beats want that are not wired', () => {
    expect(unknownBlocks([beat({ blocks: ['hook'] }), beat({ blocks: ['ghost', 'hook'] })], catalogue)).toEqual(['ghost']);
  });
  it('collects the fact keys the assembler will read', () => {
    expect([...boundFactKeys([beat({ factBindings: { stars: 'stars', headline: 'name' } }), beat({ factBindings: { stars: 'stars' } })])].sort()).toEqual(['name', 'stars']);
  });
});

describe('toPackets', () => {
  it('builds a valid, self-contained plan whose scenes carry the beat bindings and the model\'s choices', () => {
    const scenes = expandBeats([beat({ weight: 0.5, blocks: ['text-card'] }), beat({ count: 2, blocks: ['hook'], factBindings: { stars: 'stars' } })], catalogue);
    const { plan, script } = toPackets({
      language: 'EN',
      audioScript: '  Hello there.  ',
      scenes: [
        { block: 'text-card', tone: 'cool', fields: { kicker: 'HI', bogus: 'x' }, props: { headline: 'T' } },
        { block: 'hook', tone: 'neon', props: { headline: 'A' } },
        { block: 'hook', props: { headline: 'B' } },
      ],
    }, scenes, STAGE, catalogue);
    expect(DirectorPlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.language).toBe('en');
    expect(script.text).toBe('Hello there.');
    expect(plan.stage.name).toBe('Dark');
    expect(plan.blocks.map((b) => b.id)).toEqual(['text-card', 'hook', 'card']);
    expect(plan.scenes.map((s) => s.blockId)).toEqual(['text-card', 'hook', 'hook']);
    expect(plan.scenes[0]!.tone).toBe('cool');
    expect(plan.scenes[0]!.fields).toEqual({ kicker: 'HI' }); // unknown fields dropped
    expect(plan.scenes[1]!.tone).toBeUndefined(); // a tone the stage lacks is dropped, not fatal
    expect(plan.scenes[0]!.factBindings).toBeUndefined();
    expect(plan.scenes[1]!.factBindings).toEqual({ stars: 'stars' });
    expect(plan.scenes.map((s) => s.weight)).toEqual([0.5, 1, 1]);
  });
});
