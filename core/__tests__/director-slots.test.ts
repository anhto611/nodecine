import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { _resetSceneRegistry, registerScene } from '../scenes/registry';
import { registerCoreScenes, TITLE_CARD } from '../scenes/title-card';
import { boundFactKeys, expandSlots, modelSchemaFor, outputSchemaFor, toPackets, unknownSceneTypes, type Slot } from '../director/slots';
import { DirectorPlanSchema } from '../types/payloads';

const CARD = 'test/card';
const CardProps = z.object({
  headline: z.string().min(1).max(60),
  stars: z.number().int().nullable().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const slot = (over: Partial<Slot> = {}): Slot => ({ sceneType: CARD, weight: 1, count: 1, factBindings: {}, ...over });

beforeEach(() => {
  _resetSceneRegistry();
  registerCoreScenes();
  registerScene({ sceneType: CARD, propsSchema: CardProps });
});

describe('expandSlots', () => {
  it('unrolls each slot by its count, in order, keeping weight and bindings', () => {
    const scenes = expandSlots([
      slot({ sceneType: TITLE_CARD, weight: 0.5 }),
      slot({ count: 3, factBindings: { stars: 'stars' } }),
    ]);
    expect(scenes.map((s) => s.sceneType)).toEqual([TITLE_CARD, CARD, CARD, CARD]);
    expect(scenes[0]!.weight).toBe(0.5);
    expect(scenes[1]!.factBindings).toEqual({ stars: 'stars' });
  });
});

describe('modelSchemaFor', () => {
  it('leaves fact-bound props out of what the model must write', () => {
    const schema = modelSchemaFor({ sceneType: CARD, weight: 1, factBindings: { stars: 'stars' } });
    expect(schema.safeParse({ headline: 'HI', accentColor: '#112233' }).success).toBe(true);
    // A bound field the model wrote anyway is dropped rather than rejected.
    const parsed = schema.parse({ headline: 'HI', accentColor: '#112233', stars: 999 }) as Record<string, unknown>;
    expect('stars' in parsed).toBe(false);
  });

  it('strips fields the model invents', () => {
    const parsed = modelSchemaFor({ sceneType: CARD, weight: 1, factBindings: {} }).parse({ headline: 'HI', accentColor: '#112233', url: 'evil' }) as Record<string, unknown>;
    expect('url' in parsed).toBe(false);
  });

  it('ignores a binding for a prop the scene does not have', () => {
    const schema = modelSchemaFor({ sceneType: CARD, weight: 1, factBindings: { nope: 'x' } });
    expect(schema.safeParse({ headline: 'HI', accentColor: '#112233' }).success).toBe(true);
  });
});

describe('outputSchemaFor', () => {
  it('demands exactly one object per scene, in order', () => {
    const scenes = expandSlots([slot({ sceneType: TITLE_CARD }), slot({ count: 2 })]);
    const schema = outputSchemaFor(scenes);
    const good = { language: 'en', audioScript: 'A narration long enough to count as one.', scenes: [{ headline: 'T' }, { headline: 'A', accentColor: '#112233' }, { headline: 'B', accentColor: '#112233' }] };
    expect(schema.safeParse(good).success).toBe(true);
    expect(schema.safeParse({ ...good, scenes: good.scenes.slice(0, 2) }).success).toBe(false);
    expect(schema.safeParse({ ...good, scenes: [...good.scenes, { headline: 'extra' }] }).success).toBe(false);
  });

  it('refuses an empty scene list', () => {
    expect(() => outputSchemaFor([])).toThrow();
  });
});

describe('unknownSceneTypes / boundFactKeys', () => {
  it('names scene types nothing registered', () => {
    expect(unknownSceneTypes([slot(), slot({ sceneType: 'ghost/scene' })])).toEqual(['ghost/scene']);
  });
  it('collects the fact keys the assembler will read', () => {
    expect([...boundFactKeys([slot({ factBindings: { stars: 'stars', headline: 'name' } }), slot({ factBindings: { stars: 'stars' } })])].sort()).toEqual(['name', 'stars']);
  });
});

describe('toPackets', () => {
  it('builds a valid plan whose scenes carry the slot bindings', () => {
    const scenes = expandSlots([slot({ sceneType: TITLE_CARD, weight: 0.5 }), slot({ count: 2, factBindings: { stars: 'stars' } })]);
    const { plan, script } = toPackets({ language: 'EN', audioScript: '  Hello there.  ', scenes: [{ headline: 'T' }, { headline: 'A', accentColor: '#112233' }, { headline: 'B', accentColor: '#112233' }] }, scenes, 'core/dark');
    expect(DirectorPlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.language).toBe('en');
    expect(script.text).toBe('Hello there.');
    expect(plan.scenes[0]!.factBindings).toBeUndefined();
    expect(plan.scenes[1]!.factBindings).toEqual({ stars: 'stars' });
    expect(plan.scenes.map((s) => s.weight)).toEqual([0.5, 1, 1]);
  });
});
