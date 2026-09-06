import { describe, expect, it } from 'vitest';
import { buildDirectorPrompt, factsForPrompt } from '@/nodes/director/prompt';
import { expandBeats } from '@/nodes/director/beats';
import { describeBlockField } from '@/core/look/props';
import type { FactSheet } from '@/core/types/payloads';

const sheet: FactSheet = {
  mode: 'fetched',
  sourceLabel: 'github.com/acme/widget',
  fetchedAt: '2026-09-05T00:00:00.000Z',
  facts: { name: 'widget', description: 'Tiny widgets for the web.', stars: 4321, topics: ['widgets', 'web'], url: 'github.com/acme/widget', installCommand: 'npm install widget' },
};

describe('describeBlockField', () => {
  it('turns a field into an honest hint: shape from the type and limits, intent from the hint', () => {
    expect(describeBlockField({ type: 'string', required: true, max: 60, hint: 'six words' })).toBe('text, up to 60 characters — six words');
    expect(describeBlockField({ type: 'number', required: false, min: 0, max: 10 })).toBe('number 0–10 (optional)');
    expect(describeBlockField({ type: 'string[]', required: true, min: 3, max: 3 })).toBe('[exactly 3 × text]');
    expect(describeBlockField({ type: 'color', required: true })).toBe('#rrggbb');
  });
});

describe('factsForPrompt', () => {
  it('shows every fact except the ones bound straight into a scene', () => {
    const lines = factsForPrompt(sheet, new Set(['stars', 'installCommand']));
    expect(lines.join('\n')).toContain('- name: widget');
    expect(lines.join('\n')).toContain('- topics: widgets, web');
    expect(lines.join('\n')).not.toContain('4321');
    expect(lines.join('\n')).not.toContain('npm install');
  });

  it('is empty with no sheet, and stops at the character budget', () => {
    expect(factsForPrompt(undefined, new Set())).toEqual([]);
    const lines = factsForPrompt({ ...sheet, facts: { a: 'x'.repeat(50), b: 'y'.repeat(50) } }, new Set(), 40);
    expect(lines).toHaveLength(1);
  });
});

describe('buildDirectorPrompt', () => {
  const scenes = expandBeats([
    { role: 'open', brief: 'Name the subject.', weight: 0.5, count: 1, factBindings: {} },
    { role: 'proof', brief: '', weight: 1, count: 2, factBindings: { number: 'stars' } },
  ]);

  it('carries the brief, the count, the language, the beats and the content vocabulary — and no block', () => {
    const p = buildDirectorPrompt({ brief: 'Introduce widget to busy people.', facts: sheet, excludeFacts: new Set(['stars']), scenes, language: 'vi', strict: false });
    expect(p).toContain('Introduce widget to busy people.');
    expect(p).toContain('video with 3 scenes');
    expect(p).toContain('Vietnamese');
    expect(p).toContain('exactly 3 scenes');
    expect(p).toContain('1. open — Name the subject.');
    expect(p).toContain('2. proof (do not write: number)');
    expect(p).toContain('3. proof (do not write: number)');
    for (const key of ['kicker', 'title', 'body', 'points', 'number', 'label', 'quote', 'attribution', 'code', 'source']) expect(p).toContain(`- ${key}: `);
    expect(p).not.toMatch(/\bblock\b/i);
    expect(p).not.toMatch(/\bstage\b/i);
  });

  it('never asks the model for a fact-bound key, and says so', () => {
    const p = buildDirectorPrompt({ brief: 'x', facts: sheet, excludeFacts: new Set(['stars']), scenes, language: 'en', strict: false });
    expect(p).toContain('the keys "number" are filled in later');
    expect(p).not.toContain('4321');
  });

  it('gets stricter only on the language retry', () => {
    const soft = buildDirectorPrompt({ brief: 'x', excludeFacts: new Set(), scenes, language: 'vi', strict: false });
    const hard = buildDirectorPrompt({ brief: 'x', excludeFacts: new Set(), scenes, language: 'vi', strict: true });
    expect(soft).not.toContain('mandatory');
    expect(hard).toContain('mandatory');
  });

  it('works with no facts', () => {
    const p = buildDirectorPrompt({ brief: 'Four quotes about patience.', excludeFacts: new Set(), scenes, language: 'en', strict: false });
    expect(p).not.toContain('Facts about the subject');
  });
});
