import { describe, expect, it } from 'vitest';
import { bindingsFor, castScenes, clipText, fillProps, fitOf, propValue } from '../cast';
import { ScenePlanSchema, type SceneScript } from '@/core/types/payloads';
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

describe('clipText and list limits', () => {
  it('cuts text to the block limit at a word boundary and never exceeds it', () => {
    const long = 'Star the repo, read the docs, open your first issue and tell a friend who ships APIs.';
    const cut = clipText(long, 40);
    expect(cut.length).toBeLessThanOrEqual(40);
    expect(cut).toBe('Star the repo, read the docs, open…');
    expect(clipText('short', 40)).toBe('short');
    expect(propValue({ type: 'text', required: true, max: 20 }, 'one two three four five six')).toBe('one two three four…');
  });

  it('cuts a list to the block maximum and refuses one below the minimum', () => {
    expect(propValue({ type: 'string[]', required: true, min: 3, max: 3 }, ['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c']);
    expect(propValue({ type: 'string[]', required: true, min: 3, max: 3 }, ['a', 'b'])).toBeUndefined();
    expect(fitOf(CARD, { title: 'T', kicker: 'calm', points: ['a', 'b'] }, new Set()).missing).toEqual(['features']);
  });

  it('notes every prop it had to cut', () => {
    const tiny = { ...TEXT_CARD, id: 'tiny', props: { ...TEXT_CARD.props, headline: { ...TEXT_CARD.props.headline!, max: 10 } } };
    const { plan, notes } = castScenes(script([{ role: 'x', weight: 1, narration: 'n', content: { title: 'A headline far longer than ten' } }]), { ...look, blocks: [tiny] }, []);
    expect((plan.scenes[0]!.props.headline as string).length).toBeLessThanOrEqual(10);
    expect(notes).toEqual(['scene 1 (x): "headline" of tiny cut to 10 characters']);
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
        { role: 'open', weight: 0.5, narration: 'n', content: { kicker: 'HI', title: 'Hello', body: 'A line.' } },
        { role: 'list', weight: 1, narration: 'n', content: { kicker: 'calm', title: 'Three', points: ['a', 'b', 'c'] } },
      ]),
      look,
      [{ role: 'open', tone: 'cool' }],
    );
    expect(notes).toEqual([]);
    expect(ScenePlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.scenes.map((s) => s.blockId)).toEqual(['text-card', 'card']);
    expect(plan.scenes[0]).toMatchObject({ tone: 'cool', fields: { kicker: 'HI' }, props: { headline: 'Hello', body: 'A line.' }, weight: 0.5 });
    expect(plan.scenes[1]!.props).toEqual({ headline: 'Three', features: ['a', 'b', 'c'], mood: 'calm' });
    expect(plan.stage.name).toBe('Dark');
    expect(plan.blocks).toHaveLength(3);
  });

  it('spreads a run of alike scenes over the blocks that fit them equally well', () => {
    const twin = { ...TEXT_CARD, id: 'twin', name: 'Twin' };
    const three = script([1, 2, 3].map((n) => ({ role: 'body', weight: 1, narration: 'n', content: { title: `T${n}`, body: 'b' } })));
    const { plan } = castScenes(three, { ...look, blocks: [TEXT_CARD, twin, HOOK] }, []);
    // hook has two optional props left empty, so the two exact fits alternate and hook waits its turn.
    expect(plan.scenes.map((s) => s.blockId)).toEqual(['text-card', 'twin', 'text-card']);
  });

  it('honours a cast block when it fits, and says why when it falls back', () => {
    const fits = castScenes(script([{ role: 'x', weight: 1, narration: 'n', content: { title: 'T' } }]), look, [{ role: 'x', block: 'hook' }]);
    expect(fits.plan.scenes[0]!.blockId).toBe('hook');
    const cannot = castScenes(script([{ role: 'x', weight: 1, narration: 'n', content: { title: 'T' } }]), look, [{ role: 'x', block: 'card' }]);
    expect(cannot.plan.scenes[0]!.blockId).toBe('text-card');
    expect(cannot.notes[0]).toMatch(/block "card" needs features, mood/);
    const gone = castScenes(script([{ role: 'x', weight: 1, narration: 'n', content: { title: 'T' } }]), look, [{ role: 'x', block: 'ghost', tone: 'neon' }]);
    expect(gone.notes).toHaveLength(2);
  });

  it('refuses a scene no block can show, naming the closest block and what it still needs', () => {
    expect(() => castScenes(script([{ role: 'q', weight: 1, narration: 'n', content: { quote: 'Only a quote.' } }]), look, [])).toThrow(/scene 1 \(q\) says quote and no block of the look can show that; "text-card" still needs headline/);
  });

  it('translates content bindings onto the cast block and keeps the bound prop out of props', () => {
    const { plan } = castScenes(script([{ role: 'proof', weight: 1, narration: 'n', content: { title: 'Stars' }, factBindings: { number: 'stars' } }]), look, [{ role: 'proof', block: 'hook' }]);
    expect(plan.scenes[0]).toMatchObject({ blockId: 'hook', props: { headline: 'Stars' }, factBindings: { stars: 'stars' } });
  });
});
