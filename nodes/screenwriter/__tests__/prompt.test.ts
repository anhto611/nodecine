import { describe, expect, it } from 'vitest';
import { buildScreenwriterPrompt, factsForPrompt } from '@/nodes/screenwriter/prompt';
import { expandBeats } from '@/nodes/screenwriter/beats';
import type { FactSheet } from '@/core/types/payloads';

const sheet: FactSheet = {
  mode: 'fetched',
  sourceLabel: 'github.com/acme/widget',
  fetchedAt: '2026-09-05T00:00:00.000Z',
  facts: { name: 'widget', description: 'Tiny widgets for the web.', stars: 4321, topics: ['widgets', 'web'], url: 'github.com/acme/widget', installCommand: 'npm install widget' },
};

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

describe('buildScreenwriterPrompt', () => {
  const scenes = expandBeats([
    { role: 'open', brief: 'Name the subject.', weight: 0.5, count: 1, factBindings: {} },
    { role: 'proof', brief: '', weight: 1, count: 2, factBindings: { number: 'stars' } },
  ]);

  it('carries the brief, count, language, beats and content vocabulary — without drawing instructions', () => {
    const p = buildScreenwriterPrompt({ brief: 'Introduce widget to busy people.', facts: sheet, excludeFacts: new Set(['stars']), scenes, language: 'vi', strict: false });
    expect(p).toContain('Introduce widget to busy people.');
    expect(p).toContain('video with 3 scenes');
    expect(p).toContain('Vietnamese');
    expect(p).toContain('exactly 3 scenes');
    expect(p).toContain('1. open — Name the subject. (say 7–10 words)');
    expect(p).toContain('2. proof (say 13–17 words; do not write: number)');
    expect(p).toContain('3. proof (say 13–17 words; do not write: number)');
    expect(p).toContain('"narration"');
    for (const key of ['kicker', 'title', 'body', 'points', 'number', 'label', 'quote', 'attribution', 'code', 'source']) expect(p).toContain(`- ${key}: `);
    expect(p).not.toMatch(/\bblock\b/i);
    expect(p).not.toMatch(/\bstage\b/i);
  });

  it('never asks the model for a fact-bound key, and says so', () => {
    const p = buildScreenwriterPrompt({ brief: 'x', facts: sheet, excludeFacts: new Set(['stars']), scenes, language: 'en', strict: false });
    expect(p).toContain('the keys "number" are filled in later');
    expect(p).not.toContain('4321');
  });

  it('gets stricter only on the language retry', () => {
    const soft = buildScreenwriterPrompt({ brief: 'x', excludeFacts: new Set(), scenes, language: 'vi', strict: false });
    const hard = buildScreenwriterPrompt({ brief: 'x', excludeFacts: new Set(), scenes, language: 'vi', strict: true });
    expect(soft).not.toContain('mandatory');
    expect(hard).toContain('mandatory');
  });

  it('works with no facts', () => {
    const p = buildScreenwriterPrompt({ brief: 'Four quotes about patience.', excludeFacts: new Set(), scenes, language: 'en', strict: false });
    expect(p).not.toContain('Facts about the subject');
  });
});
