import { describe, expect, it } from 'vitest';
import { buildScreenwriterPrompt, factsForPrompt } from '@/nodes/screenwriter/prompt';
import { WORDS_PER_SECOND, expandBeats, wordBudget } from '@/nodes/screenwriter/beats';
import type { FactSheet } from '@/contracts/types/payloads';

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

/**
 * Writing for a film form (CORE_CONTRACTS §6). What the form changes here is not decoration: it says
 * how the words are shaped, and it narrows the vocabulary so a form of big numbers is not handed the
 * word "body" and does not come back with a paragraph nobody can place.
 */
describe('a form the script is written for', () => {
  const beats = expandBeats([{ role: 'scene', brief: '', weight: 1, count: 2, factBindings: {} }], undefined);
  const base = { brief: 'a brief', excludeFacts: new Set<string>(), scenes: beats, language: 'vi', strict: false };

  it('puts its guidance in, above the vocabulary', () => {
    const p = buildScreenwriterPrompt({ ...base, form: { guidance: 'Nobody speaks. One line per scene.' } });
    expect(p).toContain("This film's form — how it has to be written:");
    expect(p).toContain('Nobody speaks. One line per scene.');
    expect(p.indexOf('Nobody speaks')).toBeLessThan(p.indexOf('Each scene is a JSON object'));
  });

  it('offers only the keys the form is made of', () => {
    const p = buildScreenwriterPrompt({ ...base, form: { guidance: 'g', keys: ['title', 'number', 'label'] } });
    expect(p).toContain('- title:');
    expect(p).toContain('- number:');
    expect(p).not.toContain('- body:');
    expect(p).not.toContain('- quote:');
  });

  it('offers the whole vocabulary when the form names no keys, and when there is no form', () => {
    const all = buildScreenwriterPrompt({ ...base, form: { guidance: 'g' } });
    expect(all).toContain('- body:');
    const none = buildScreenwriterPrompt(base);
    expect(none).toContain('- body:');
    expect(none).not.toContain("This film's form");
  });
});

/**
 * How long a scene speaks, which is how long a scene lasts. Until forms arrived, every scene was
 * budgeted the same paragraph regardless of what kind of film it belonged to, so "make it twenty
 * seconds" in the brief was a note nobody downstream could act on, and a film of four-word phrases
 * came out at seven seconds a scene.
 */
describe('the word budget', () => {
  const beats = expandBeats([{ role: 'a', brief: '', weight: 1, count: 2, factBindings: {} }, { role: 'b', brief: '', weight: 2, count: 1, factBindings: {} }], undefined);
  const base = { brief: 'a brief', excludeFacts: new Set<string>(), scenes: beats, language: 'vi', strict: false };

  it('is the old paragraph when nothing says otherwise', () => {
    expect(wordBudget(1)).toEqual({ min: 13, max: 17 });
    expect(wordBudget(2)).toEqual({ min: 26, max: 34 });
    expect(buildScreenwriterPrompt(base)).toContain('say 13–17 words');
  });

  it('is the form\'s shape of scene when it has one, scaled by weight', () => {
    expect(wordBudget(1, { words: { min: 4, max: 9 } })).toEqual({ min: 4, max: 9 });
    expect(wordBudget(2, { words: { min: 4, max: 9 } })).toEqual({ min: 8, max: 18 });
    const p = buildScreenwriterPrompt({ ...base, form: { guidance: 'g', words: { min: 4, max: 9 } } });
    expect(p).toContain('say 4–9 words');
    expect(p).toContain('say 8–18 words');
  });

  it('is shared out of a length somebody asked for, and says so', () => {
    // 20 seconds at 2.6 words a second is 52 words over weights 1, 1, 2.
    const p = buildScreenwriterPrompt({ ...base, targetSeconds: 20 });
    expect(p).toContain('should take about 20 seconds to read aloud');
    expect(p).toContain('say 11–15 words');
    expect(p).toContain('say 22–30 words');
    const total = [...p.matchAll(/say (\d+)–(\d+) words/g)].reduce((n, m) => n + (Number(m[1]) + Number(m[2])) / 2, 0);
    expect(Math.abs(total - 20 * WORDS_PER_SECOND)).toBeLessThan(3);
  });
});

/**
 * The catalogue in the prompt (docs/CORE_CONTRACTS §5.8).
 *
 * Cutdown's rule, worth copying whole: print only the layouts the running film really has. What the
 * model sees is what it writes, so a shape offered but undrawn is a scene the builder refuses after
 * the expensive half of the run is already paid for.
 */
describe('the layouts the writer may choose from', () => {
  const beats = expandBeats([{ role: 'a', brief: '', weight: 1, count: 2, factBindings: {} }], undefined);
  const base = { brief: 'a brief', excludeFacts: new Set<string>(), scenes: beats, language: 'vi', strict: false };
  const shapes = [
    { keys: ['kicker', 'title', 'body'], budget: { title: 64 } },
    { keys: ['kicker', 'number', 'label'] },
  ];

  it('are listed, lettered, with the length each hole takes', () => {
    const p = buildScreenwriterPrompt({ ...base, shapes });
    expect(p).toContain('A. kicker, title (≤64 chars), body');
    expect(p).toContain('B. kicker, number, label');
    expect(p).toContain('EXACTLY ONE');
  });

  it('narrow the vocabulary to the keys some layout actually draws', () => {
    const p = buildScreenwriterPrompt({ ...base, shapes });
    expect(p).toContain('- number:');
    expect(p).toContain('- title:');
    // No layout draws a quote, so offering one invites a scene nothing can draw.
    expect(p).not.toContain('- quote:');
  });

  it('are absent, and the whole vocabulary offered, when no catalogue reached the node', () => {
    const p = buildScreenwriterPrompt(base);
    expect(p).not.toContain('EXACTLY ONE');
    expect(p).toContain('- quote:');
  });
});
