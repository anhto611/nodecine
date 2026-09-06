import { describe, expect, it } from 'vitest';
import { buildCastingPrompt, pickWithModel, picksFromAnswer } from '../cast-ai';
import { castScenes, sceneCandidates } from '../cast';
import type { LLMRef, SceneScript } from '@/core/types/payloads';
import { CARD, HOOK, STAGE, TEXT_CARD } from '@/core/__tests__/look-fixtures';

const look = { ...STAGE, blocks: [TEXT_CARD, HOOK, CARD] };
// A second block that shows the same content as text-card, so the opening scene has a real choice.
const TWIN = { ...TEXT_CARD, id: 'twin', name: 'Twin', doc: { when: 'A second card, for variety.', example: '' } };
const look2 = { ...STAGE, blocks: [TEXT_CARD, TWIN, HOOK, CARD] };
const ref = { providerId: 'claude-code', displayName: 'x', transport: 'cli', capabilities: {}, settings: {} } as unknown as LLMRef;
const script: SceneScript = {
  language: 'en',
  scenes: [
    { role: 'open', weight: 1, narration: 'Meet the widget.', content: { title: 'Meet', body: 'A widget.' } },
    { role: 'body', weight: 1, narration: 'Three things it does.', content: { kicker: 'calm', title: 'Three', points: ['a', 'b', 'c'] } },
  ],
};
const quiet = () => undefined;

describe('sceneCandidates / buildCastingPrompt', () => {
  it('separates blocks that show a scene whole from ones that lose content, and honours a pin that fits', () => {
    const c = sceneCandidates(script, look, [{ role: 'open', block: 'hook' }]);
    // hook fits (it has a headline) but has nowhere for the body; the kicker is the stage's, so nobody loses it.
    expect(c[0]).toEqual({ role: 'open', pinned: 'hook', candidates: ['text-card'], partial: [{ id: 'hook', dropped: ['body'] }] });
    expect(c[1]!.candidates).toEqual(['card']);
    expect(c[1]!.partial).toEqual([{ id: 'text-card', dropped: ['points'] }, { id: 'hook', dropped: ['points'] }]);
  });

  it('asks the model only where there is a real choice, and says what the voice says', () => {
    expect(buildCastingPrompt(script, look, [])).toBeNull(); // one covering block per scene: nothing to decide
    const built = buildCastingPrompt(script, look2, [])!;
    expect(built.prompt).toContain('says: "Three things it does."');
    expect(built.prompt).toContain('choose one of: text-card | twin');
    expect(built.prompt).toContain('- twin: A second card, for variety.');
    expect(built.prompt).not.toContain('- hook:'); // never offered: it would lose the body
    expect(built.prompt).toContain('exactly 2 entries');
  });

  it('offers blocks that lose content only when nothing shows the scene whole, and says what each loses', () => {
    const noCard = { ...look, blocks: [TEXT_CARD, TWIN, HOOK] };
    const built = buildCastingPrompt(script, noCard, [])!;
    expect(built.prompt).toContain('choose one of: text-card (loses points) | twin (loses points) | hook (loses points)');
  });

  it('has nothing to ask when every scene is pinned or has one fit', () => {
    expect(buildCastingPrompt(script, look, [{ role: 'open', block: 'hook' }, { role: 'body', block: 'card' }])).toBeNull();
  });
});

describe('picksFromAnswer / castScenes with picks', () => {
  it('keeps a valid choice, drops one outside the list, and lets the user\'s pin win', () => {
    const candidates = sceneCandidates(script, look, [{ role: 'open', block: 'hook' }]);
    const picks = picksFromAnswer({ scenes: [{ block: 'text-card', tone: 'cool' }, { block: 'ghost' }] }, candidates);
    expect(picks).toEqual([{ block: 'hook', tone: 'cool' }, {}]);
    const { plan, notes } = castScenes(script, look, [{ role: 'open', block: 'hook' }], picks);
    expect(plan.scenes.map((s) => s.blockId)).toEqual(['hook', 'card']); // card: the rule, since the model's pick was dropped
    expect(plan.scenes[0]!.tone).toBe('cool');
    // The user's pin is honoured, and the plan says what it cost.
    expect(notes).toEqual(['scene 1 (open): hook has no place for body']);
  });

  it('notes a model pick that cannot show the scene and falls back to the rule', () => {
    const { plan, notes } = castScenes(script, look, [], [{ block: 'card' }, undefined]);
    expect(plan.scenes[0]!.blockId).toBe('text-card');
    expect(notes[0]).toMatch(/the model chose "card"/);
  });
});

describe('pickWithModel', () => {
  it('asks once, validates, and returns the picks', async () => {
    const calls: string[] = [];
    const services = { complete: async (_r: LLMRef, prompt: string) => { calls.push(prompt); return { scenes: [{ block: 'hook' }, { block: 'card', tone: 'warm' }] }; } };
    const picks = await pickWithModel(services as never, ref, script, look2, [], new AbortController().signal, quiet);
    expect(calls).toHaveLength(1);
    // hook is not on offer for the opening (it would lose the body), so that pick is dropped; card is.
    expect(picks).toEqual([{}, { block: 'card', tone: 'warm' }]);
  });

  it('retries a bad shape once, then casts by content with a warning instead of failing', async () => {
    let n = 0;
    const warnings: string[] = [];
    const services = { complete: async () => { n++; throw new Error('not json'); } };
    const picks = await pickWithModel(services as never, ref, script, look2, [], new AbortController().signal, (level, m) => { if (level === 'warn') warnings.push(m); });
    expect(n).toBe(2);
    expect(picks).toEqual([]);
    expect(warnings[1]).toMatch(/casting by content instead/);
  });
});
