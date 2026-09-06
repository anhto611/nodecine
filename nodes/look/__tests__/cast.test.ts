import { describe, expect, it } from 'vitest';
import { bindingsFor, castScenes, fillProps, fitOf, propValue } from '../cast';
import { DirectorPlanSchema, type SceneScript } from '@/core/types/payloads';
import { CARD, HOOK, STAGE, TEXT_CARD } from '@/core/__tests__/look-fixtures';

const look = { ...STAGE, blocks: [TEXT_CARD, HOOK, CARD] };
const script = (scenes: SceneScript['scenes']): SceneScript => ({ language: 'en', scenes });

describe('propValue', () => {
  it('shapes content for the field: lists join for text, text wraps for lists, figures parse for numbers', () => {
    expect(propValue({ type: 'text', required: true }, ['a', 'b'])).toBe('a, b');
    expect(propValue({ type: 'string[]', required: true }, 'one')).toEqual(['one']);
    expect(propValue({ type: 'number', required: true }, '4,321')).toBe(4321);
    expect(propValue({ type: 'number', required: true }, 'many')).toBeUndefined();
    expect(propValue({ type: 'color', required: true }, '#fff')).toBeUndefined();
    expect(propValue({ type: 'string', required: true }, '')).toBeUndefined();
  });
});

describe('fitOf / fillProps / bindingsFor', () => {
  it('counts the props the content fills and names the required ones it cannot', () => {
    const fit = fitOf(CARD, { title: 'T', points: ['a', 'b', 'c'] }, new Set());
    expect(fit.filled).toBe(2);
    expect(fit.missing).toEqual(['mood']); // kicker missing; accentColor is optional
    expect(fitOf(CARD, { title: 'T', points: ['a', 'b', 'c'], kicker: 'calm' }, new Set()).missing).toEqual([]);
  });

  it('treats a bound key as filled, leaves it out of the props, and binds the prop that shows it', () => {
    const bound = new Set(['number']);
    expect(fitOf(HOOK, { title: 'T' }, bound).filled).toBe(2);
    expect(fillProps(HOOK, { title: 'T', number: '9' }, bound)).toEqual({ headline: 'T' });
    expect(bindingsFor(HOOK, { number: 'stars' })).toEqual({ stars: 'stars' });
    expect(bindingsFor(TEXT_CARD, { number: 'stars' })).toEqual({});
  });
});

describe('castScenes', () => {
  it('picks the block that shows the most of what a scene says, and writes the stage fields and the tone', () => {
    const { plan, notes } = castScenes(
      script([
        { role: 'open', weight: 0.5, content: { kicker: 'HI', title: 'Hello', body: 'A line.' } },
        { role: 'list', weight: 1, content: { kicker: 'calm', title: 'Three', points: ['a', 'b', 'c'] } },
      ]),
      look,
      [{ role: 'open', tone: 'cool' }],
    );
    expect(notes).toEqual([]);
    expect(DirectorPlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.scenes.map((s) => s.blockId)).toEqual(['text-card', 'card']);
    expect(plan.scenes[0]).toMatchObject({ tone: 'cool', fields: { kicker: 'HI' }, props: { headline: 'Hello', body: 'A line.' }, weight: 0.5 });
    expect(plan.scenes[1]!.props).toEqual({ headline: 'Three', features: ['a', 'b', 'c'], mood: 'calm' });
    expect(plan.stage.name).toBe('Dark');
    expect(plan.blocks).toHaveLength(3);
  });

  it('honours a cast block when it fits, and says why when it falls back', () => {
    const fits = castScenes(script([{ role: 'x', weight: 1, content: { title: 'T' } }]), look, [{ role: 'x', block: 'hook' }]);
    expect(fits.plan.scenes[0]!.blockId).toBe('hook');
    const cannot = castScenes(script([{ role: 'x', weight: 1, content: { title: 'T' } }]), look, [{ role: 'x', block: 'card' }]);
    expect(cannot.plan.scenes[0]!.blockId).toBe('text-card');
    expect(cannot.notes[0]).toMatch(/block "card" needs features, mood/);
    const gone = castScenes(script([{ role: 'x', weight: 1, content: { title: 'T' } }]), look, [{ role: 'x', block: 'ghost', tone: 'neon' }]);
    expect(gone.notes).toHaveLength(2);
  });

  it('refuses a scene no block can show, naming the closest block and what it still needs', () => {
    expect(() => castScenes(script([{ role: 'q', weight: 1, content: { quote: 'Only a quote.' } }]), look, [])).toThrow(/scene 1 \(q\) says quote and no block of the look can show that; "text-card" still needs headline/);
  });

  it('translates content bindings onto the cast block and keeps the bound prop out of props', () => {
    const { plan } = castScenes(script([{ role: 'proof', weight: 1, content: { title: 'Stars' }, factBindings: { number: 'stars' } }]), look, [{ role: 'proof', block: 'hook' }]);
    expect(plan.scenes[0]).toMatchObject({ blockId: 'hook', props: { headline: 'Stars' }, factBindings: { stars: 'stars' } });
  });
});
