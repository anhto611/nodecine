import { describe, expect, it } from 'vitest';
import { buildDirectorPrompt, describeBlock, factsForPrompt } from '../director/prompt';
import { expandBeats } from '../director/beats';
import { describeBlockField } from '../look/props';
import type { FactSheet } from '../types/payloads';
import { CARD, HOOK, STAGE, TEXT_CARD } from './look-fixtures';

const sheet: FactSheet = {
  mode: 'fetched',
  sourceLabel: 'github.com/acme/widget',
  fetchedAt: '2026-09-05T00:00:00.000Z',
  facts: { name: 'widget', description: 'Tiny widgets for the web.', stars: 4321, topics: ['widgets', 'web'], url: 'github.com/acme/widget', installCommand: 'npm install widget' },
};

describe('describeBlockField', () => {
  it('turns a field into an honest hint: shape from the type and limits, intent from the hint', () => {
    expect(describeBlockField({ type: 'string', required: true, max: 60 })).toBe('text, up to 60 characters');
    expect(describeBlockField({ type: 'text', required: false, max: 160, hint: 'one sentence' })).toBe('text, up to 160 characters — one sentence (optional)');
    expect(describeBlockField({ type: 'color', required: true })).toBe('#rrggbb');
    expect(describeBlockField({ type: 'string[]', required: true, min: 3, max: 3, hint: 'three short lines' })).toBe('[exactly 3 × text] — three short lines');
    expect(describeBlockField({ type: 'number', required: false, min: 0 })).toBe('number (optional)');
    expect(describeBlockField({ type: 'boolean', required: true })).toBe('true or false');
  });
});

describe('describeBlock', () => {
  it('says when to use the block, what to write, and leaves bound props out', () => {
    const lines = describeBlock(CARD, new Set(['stars'])).join('\n');
    expect(lines).toContain('- card — A card with three features.');
    expect(lines).toContain('"features": "[exactly 3 × text] — three short lines"');
    expect(lines).not.toMatch(/"stars":/);
    expect(lines).toContain('example: {"headline":"HI"');
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
  const catalogue = [TEXT_CARD, HOOK, CARD];
  const scenes = expandBeats([
    { role: 'open', brief: 'Name the subject.', weight: 0.5, count: 1, blocks: ['text-card'], factBindings: {} },
    { role: 'body', brief: '', weight: 1, count: 2, blocks: ['hook', 'card'], factBindings: { stars: 'stars' } },
  ], catalogue);

  it('carries the brief, the count, the language, the beats and every block they may use', () => {
    const p = buildDirectorPrompt({ brief: 'Introduce widget to busy people.', facts: sheet, excludeFacts: new Set(['stars']), stage: STAGE, scenes, language: 'vi', strict: false });
    expect(p).toContain('Introduce widget to busy people.');
    expect(p).toContain('video with 3 scenes');
    expect(p).toContain('Vietnamese');
    expect(p).toContain('exactly 3 scenes');
    expect(p).toContain('1. open — Name the subject. (block: text-card)');
    expect(p).toContain('2. body (block: one of hook | card)');
    expect(p).toContain('3. body (block: one of hook | card)');
    for (const id of ['text-card', 'hook', 'card']) expect(p).toContain(`- ${id} — `);
    expect(p).toContain('Stage "Dark"');
    expect(p).toContain('"tone" to one of: cool, warm, green');
    expect(p).toContain('- kicker: two or three words');
  });

  it('never asks the model for a fact-bound prop, and says so', () => {
    const p = buildDirectorPrompt({ brief: 'x', facts: sheet, excludeFacts: new Set(['stars']), stage: STAGE, scenes, language: 'en', strict: false });
    expect(p).not.toMatch(/"stars":/);
    expect(p).toContain('"stars" are filled in later');
    expect(p).not.toContain('4321');
  });

  it('gets stricter only on the language retry', () => {
    const soft = buildDirectorPrompt({ brief: 'x', excludeFacts: new Set(), stage: STAGE, scenes, language: 'vi', strict: false });
    const hard = buildDirectorPrompt({ brief: 'x', excludeFacts: new Set(), stage: STAGE, scenes, language: 'vi', strict: true });
    expect(soft).not.toContain('mandatory');
    expect(hard).toContain('mandatory');
  });

  it('works with no facts, and says nothing about tones or fields when the stage has none', () => {
    const bare = { ...STAGE, tones: {}, sceneFields: [] };
    const p = buildDirectorPrompt({ brief: 'Four quotes about patience.', excludeFacts: new Set(), stage: bare, scenes, language: 'en', strict: false });
    expect(p).not.toContain('Facts about the subject');
    expect(p).not.toContain('"tone"');
    expect(p).not.toContain('"fields"');
  });
});
