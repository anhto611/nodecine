/**
 * AI Director, pure part (github-showcase spec §3): prompt, output schema, and the split into
 * the two packets. The node wraps this with the provider call and the retry rules.
 */
import { z } from 'zod';
import type { AudioScript, DirectorPlan, FactSheet } from '@/core/types/payloads';
import { detectLanguage } from '@/core/text/detect-language';
import { CTA, CtaModelSchema, HOOK, HookModelSchema, MOCKUP, MockupModelSchema, THEME } from './scenes/schemas';

/** Spec §3.1 — what the model must return. `.strip()` drops any extra field the model invents. */
export const DirectorOutputSchema = z
  .object({
    language: z.string().min(2).max(35),
    audioScript: z.string().min(20).max(1200),
    scenes: z.tuple([HookModelSchema.strip(), MockupModelSchema.strip(), CtaModelSchema.strip()]),
  })
  .strip();
export type DirectorOutput = z.infer<typeof DirectorOutputSchema>;

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', vi: 'Vietnamese', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', id: 'Indonesian', th: 'Thai', ru: 'Russian', ar: 'Arabic', hi: 'Hindi',
};
export const languageName = (code: string): string => LANGUAGE_NAMES[code.toLowerCase()] ?? code;

/** `auto` means the language of the source text (spec §3); anything else is the user's choice. */
export function resolveOutputLanguage(param: string, sheet: FactSheet): string {
  if (param && param !== 'auto') return param.toLowerCase();
  const f = sheet.facts;
  const text = [f.description, f.readmeExcerpt].filter((v): v is string => typeof v === 'string').join('\n');
  return detectLanguage(text);
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

/**
 * Spec §3.3: the prompt carries name, description, topics, primaryLanguage and readmeExcerpt —
 * never stars, installCommand, url or owner, so the model has nothing numeric to copy wrong.
 */
export function buildDirectorPrompt(sheet: FactSheet, language: string, strict = false): string {
  const f = sheet.facts;
  const topics = Array.isArray(f.topics) ? (f.topics as string[]).join(', ') : '';
  const lang = languageName(language);
  const name = str(f.name) || (sheet.mode === 'passthrough' ? 'the project' : 'the repository');
  const lines = [
    `You are the director of a 12-second vertical (9:16) showcase video about a software project.`,
    `Write ALL text in ${lang} (language code "${language}").` + (strict ? ` This is mandatory: every field, including headlines, must be ${lang}; do not use any other language.` : ''),
    ``,
    `Project name: ${name}`,
    f.description ? `Description: ${str(f.description)}` : '',
    topics ? `Topics: ${topics}` : '',
    f.primaryLanguage ? `Main programming language: ${str(f.primaryLanguage)}` : '',
    ``,
    `README excerpt:`,
    `"""`,
    str(f.readmeExcerpt).slice(0, 4000),
    `"""`,
    ``,
    `Return ONLY a JSON object, no prose, no markdown fence, with exactly this shape:`,
    `{`,
    `  "language": "${language}",`,
    `  "audioScript": "voice-over narration, 25 to 35 words (10 to 14 seconds read aloud), energetic, no URLs, no numbers about stars or downloads",`,
    `  "scenes": [`,
    `    { "headline": "UPPERCASE, max 6 words", "subline": "max 10 words", "badgeText": "short trend label, max 3 words", "accentColor": "#rrggbb" },`,
    `    { "headline": "max 6 words", "featureHighlights": ["feature 1", "feature 2", "feature 3"], "accentColor": "#rrggbb" },`,
    `    { "headline": "max 6 words", "callToActionText": "one short sentence inviting to star or contribute", "accentColor": "#rrggbb" }`,
    `  ]`,
    `}`,
    `Rules: audioScript must stay under 35 words; exactly three scenes in that order; featureHighlights has exactly three short strings; accentColor is one hex colour that suits the project, the same in all three scenes; do not mention star counts, install commands or links anywhere.`,
  ];
  return lines.filter((l) => l !== null).join('\n').replace(/\n{3,}/g, '\n\n');
}

/** Spec §3.2: two packets with their own hashes; sceneType, weight and factBindings are fixed by the pack. */
export function toPackets(out: DirectorOutput): { plan: DirectorPlan; script: AudioScript } {
  const [hook, mockup, cta] = out.scenes;
  const language = out.language.toLowerCase();
  return {
    script: { text: out.audioScript.trim(), language },
    plan: {
      language,
      theme: THEME,
      scenes: [
        { sceneType: HOOK, weight: 1, props: { ...hook }, factBindings: { stars: 'stars' } },
        { sceneType: MOCKUP, weight: 2, props: { ...mockup }, factBindings: { installCommand: 'installCommand', repoName: 'name' } },
        { sceneType: CTA, weight: 1, props: { ...cta }, factBindings: { brandName: 'url' } },
      ],
    },
  };
}

/** Compare primary subtags only: the model may answer "en-US" for "en". */
export function sameLanguage(a: string, b: string): boolean {
  return a.toLowerCase().split('-')[0] === b.toLowerCase().split('-')[0];
}
