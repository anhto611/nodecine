import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { _resetSceneRegistry, registerScene } from '../scenes/registry';
import { registerCoreScenes, TITLE_CARD } from '../scenes/title-card';
import { buildDirectorPrompt, describeField, factsForPrompt } from '../director/prompt';
import { expandSlots } from '../director/slots';
import type { FactSheet } from '../types/payloads';

const CARD = 'test/card';
beforeEach(() => {
  _resetSceneRegistry();
  registerCoreScenes();
  registerScene({
    sceneType: CARD,
    propsSchema: z.object({
      headline: z.string().min(1).max(60),
      features: z.array(z.string().max(40)).length(3),
      mood: z.enum(['calm', 'bold']),
      stars: z.number().int().nullable().optional(),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    }),
  });
});

const sheet: FactSheet = {
  mode: 'fetched',
  sourceLabel: 'github.com/acme/widget',
  fetchedAt: '2026-09-05T00:00:00.000Z',
  facts: { name: 'widget', description: 'Tiny widgets for the web.', stars: 4321, topics: ['widgets', 'web'], url: 'github.com/acme/widget', installCommand: 'npm install widget' },
};

describe('describeField', () => {
  it('turns a Zod definition into an honest hint', () => {
    expect(describeField(z.string().max(60))).toBe('text, up to 60 characters');
    expect(describeField(z.string().min(8).max(220))).toBe('text, 8–220 characters');
    expect(describeField(z.string().regex(/^#[0-9a-fA-F]{6}$/))).toBe('#rrggbb');
    expect(describeField(z.array(z.string().max(40)).length(3))).toBe('[exactly 3 × text, up to 40 characters]');
    expect(describeField(z.enum(['calm', 'bold']))).toBe('one of: calm, bold');
    expect(describeField(z.number().optional())).toBe('number');
  });
});

describe('factsForPrompt', () => {
  it('shows every fact except the ones bound straight into a scene', () => {
    const lines = factsForPrompt(sheet, new Set(['stars', 'url', 'installCommand']));
    const text = lines.join('\n');
    expect(text).toContain('widget');
    expect(text).toContain('Tiny widgets');
    expect(text).toContain('widgets, web');
    for (const hidden of ['4321', 'github.com', 'npm install']) expect(text).not.toContain(hidden);
  });

  it('is empty with no sheet, and stops at the character budget', () => {
    expect(factsForPrompt(undefined, new Set())).toEqual([]);
    const big: FactSheet = { ...sheet, facts: { readme: 'x'.repeat(10_000) } };
    expect(factsForPrompt(big, new Set(), 500).join('').length).toBeLessThan(600);
  });
});

describe('buildDirectorPrompt', () => {
  const scenes = expandSlots([
    { sceneType: TITLE_CARD, weight: 0.5, count: 1, factBindings: {} },
    { sceneType: CARD, weight: 1, count: 2, factBindings: { stars: 'stars' } },
  ]);

  it('carries the brief, the count, the language, and one shape per scene', () => {
    const p = buildDirectorPrompt({ brief: 'Introduce widget to busy people.', facts: sheet, excludeFacts: new Set(['stars']), scenes, language: 'vi', strict: false });
    expect(p).toContain('Introduce widget to busy people.');
    expect(p).toContain('video with 3 scenes');
    expect(p).toContain('Vietnamese');
    expect(p).toContain('exactly 3 scenes');
    expect((p.match(/\/\/ scene \d+:/g) ?? []).length).toBe(3);
    expect(p).toContain('core/title-card');
    expect(p).toContain('test/card');
  });

  it('never asks the model for a fact-bound field, and says so', () => {
    const p = buildDirectorPrompt({ brief: 'x', facts: sheet, excludeFacts: new Set(['stars']), scenes, language: 'en', strict: false });
    expect(p).not.toMatch(/"stars":/);
    expect(p).toContain('"stars" are filled in later');
    expect(p).not.toContain('4321');
  });

  it('gets stricter only on the language retry', () => {
    const soft = buildDirectorPrompt({ brief: 'x', excludeFacts: new Set(), scenes, language: 'vi', strict: false });
    const hard = buildDirectorPrompt({ brief: 'x', excludeFacts: new Set(), scenes, language: 'vi', strict: true });
    expect(soft).not.toContain('mandatory');
    expect(hard).toContain('mandatory');
  });

  it('works with no facts at all', () => {
    const p = buildDirectorPrompt({ brief: 'Four quotes about patience.', excludeFacts: new Set(), scenes, language: 'en', strict: false });
    expect(p).not.toContain('Facts about the subject');
  });
});
