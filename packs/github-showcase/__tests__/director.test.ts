import { describe, expect, it } from 'vitest';
import type { FactSheet } from '@/core/types/payloads';
import { DirectorPlanSchema, AudioScriptSchema } from '@/core/types/payloads';
import { DirectorOutputSchema, buildDirectorPrompt, resolveOutputLanguage, sameLanguage, toPackets } from '../director';
import { CTA, HOOK, MOCKUP, THEME } from '../scenes/schemas';

const sheet: FactSheet = {
  mode: 'fetched',
  sourceLabel: 'github.com/acme/widget',
  fetchedAt: '2026-09-05T00:00:00.000Z',
  facts: {
    owner: 'acme',
    name: 'widget',
    url: 'github.com/acme/widget',
    description: 'Tiny widgets for the web.',
    stars: 4321,
    topics: ['widgets', 'web'],
    primaryLanguage: 'TypeScript',
    readmeExcerpt: 'Widget makes widgets. Install it and go.',
    installCommand: 'npm install widget',
  },
};

const output = {
  language: 'en',
  audioScript: 'Meet Widget, the tiniest way to build widgets for the web. Install it, wire it up, and ship in minutes.',
  scenes: [
    { headline: 'TINY WIDGETS, BIG WEB', subline: 'Build UI pieces in minutes', badgeText: 'Trending', accentColor: '#7c5cff', stars: 999999 },
    { headline: 'Three things it does', featureHighlights: ['Fast', 'Small', 'Typed'], accentColor: '#7c5cff' },
    { headline: 'Try it today', callToActionText: 'Star the repo and build something.', accentColor: '#7c5cff', url: 'evil' },
  ],
};

describe('director prompt (spec §3.3)', () => {
  it('carries name, description, topics, language and README but never stars, install command, url or owner', () => {
    const p = buildDirectorPrompt(sheet, 'en');
    for (const s of ['widget', 'Tiny widgets for the web.', 'widgets, web', 'TypeScript', 'Widget makes widgets']) expect(p).toContain(s);
    for (const s of ['4321', 'npm install', 'github.com', 'acme']) expect(p).not.toContain(s);
  });
  it('names the language and gets stricter on retry', () => {
    expect(buildDirectorPrompt(sheet, 'vi')).toContain('Vietnamese');
    expect(buildDirectorPrompt(sheet, 'vi', true)).toContain('mandatory');
    expect(buildDirectorPrompt(sheet, 'vi')).not.toContain('mandatory');
  });
});

describe('output language', () => {
  it('auto follows the source text; an explicit choice wins', () => {
    expect(resolveOutputLanguage('auto', sheet)).toBe('en');
    expect(resolveOutputLanguage('auto', { ...sheet, facts: { ...sheet.facts, description: 'Bộ tiện ích nhỏ cho web.', readmeExcerpt: 'Cài đặt rồi dùng.' } })).toBe('vi');
    expect(resolveOutputLanguage('vi', sheet)).toBe('vi');
    expect(resolveOutputLanguage('VI', sheet)).toBe('vi');
  });
  it('compares primary subtags only', () => {
    expect(sameLanguage('en-US', 'en')).toBe(true);
    expect(sameLanguage('vi', 'en')).toBe(false);
  });
});

describe('output schema and packets (spec §3.1, §3.2)', () => {
  it('strips fields the model invented and rejects the wrong number of scenes or highlights', () => {
    const parsed = DirectorOutputSchema.parse(output);
    expect('stars' in parsed.scenes[0]).toBe(false);
    expect('url' in parsed.scenes[2]).toBe(false);
    expect(DirectorOutputSchema.safeParse({ ...output, scenes: output.scenes.slice(0, 2) }).success).toBe(false);
    expect(DirectorOutputSchema.safeParse({ ...output, scenes: [output.scenes[0], { ...output.scenes[1], featureHighlights: ['a', 'b'] }, output.scenes[2]] }).success).toBe(false);
    expect(DirectorOutputSchema.safeParse({ ...output, scenes: [{ ...output.scenes[0], accentColor: 'purple' }, output.scenes[1], output.scenes[2]] }).success).toBe(false);
  });

  it('splits into a DirectorPlan with fixed sceneType/weight/factBindings and an AudioScript', () => {
    const { plan, script } = toPackets(DirectorOutputSchema.parse(output));
    expect(AudioScriptSchema.safeParse(script).success).toBe(true);
    expect(DirectorPlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.theme).toBe(THEME);
    expect(plan.scenes.map((s) => [s.sceneType, s.weight])).toEqual([[HOOK, 1], [MOCKUP, 2], [CTA, 1]]);
    expect(plan.scenes[0]!.factBindings).toEqual({ stars: 'stars' });
    expect(plan.scenes[1]!.factBindings).toEqual({ installCommand: 'installCommand', repoName: 'name' });
    expect(plan.scenes[2]!.factBindings).toEqual({ brandName: 'url' });
    // The model's props carry no fact fields; the assembler will add them.
    expect(Object.keys(plan.scenes[0]!.props).sort()).toEqual(['accentColor', 'badgeText', 'headline', 'subline']);
  });
});
