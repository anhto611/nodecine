/**
 * The pure half of the Quote Director: prompt, the shape of the answer, and what the answer becomes.
 *
 * Two things differ from github-showcase and both are on purpose. The source is a line the user
 * typed rather than a fetched `FactSheet`, so nothing here reads facts. And the plan opens with
 * `core/title-card` — a scene type this pack did not define — which is the whole point of a scene
 * registry: a pack composes with what is already registered instead of redeclaring it.
 */
import { z } from 'zod';
import type { AudioScript, DirectorPlan } from '@/core/types/payloads';
import { TITLE_CARD } from '@/core/scenes/title-card';
import { QUOTE, QuoteModelSchema, THEME } from './scenes/schemas';

export const MIN_QUOTES = 3;
export const MAX_QUOTES = 6;

/** The model writes an opening card, the quotes, and the narration that runs under all of them. */
export const DirectorOutputSchema = z
  .object({
    language: z.string().min(2).max(35),
    title: z.string().min(1).max(60),
    subtitle: z.string().min(1).max(90),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    audioScript: z.string().min(20).max(1400),
    quotes: z.array(QuoteModelSchema).min(MIN_QUOTES).max(MAX_QUOTES),
  })
  .strip();
export type DirectorOutput = z.infer<typeof DirectorOutputSchema>;

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', vi: 'Vietnamese', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', es: 'Spanish',
  fr: 'French', de: 'German', pt: 'Portuguese', id: 'Indonesian', th: 'Thai',
};
export const languageName = (code: string): string => LANGUAGE_NAMES[code.toLowerCase()] ?? code;

/** Compare primary subtags only: the model may answer "en-US" when asked for "en". */
export function sameLanguage(a: string, b: string): boolean {
  return a.toLowerCase().split('-')[0] === b.toLowerCase().split('-')[0];
}

export function buildQuotePrompt(topic: string, language: string, count: number, strict = false): string {
  const lang = languageName(language);
  const subject = topic.trim() || 'perseverance';
  return [
    `You are the director of a short vertical (9:16) video of ${count} motivational quote cards.`,
    `Write ALL text in ${lang} (language code "${language}").` +
      (strict ? ` This is mandatory: every field, including the quotes and the attributions, must be ${lang}; do not use any other language.` : ''),
    ``,
    `Theme the viewer asked for: ${subject}`,
    ``,
    `Return ONLY a JSON object, no prose, no markdown fence, with exactly this shape:`,
    `{`,
    `  "language": "${language}",`,
    `  "title": "the opening card's title, max 5 words, title case",`,
    `  "subtitle": "one line under the title, max 10 words",`,
    `  "accentColor": "#rrggbb, one colour that suits the theme, used on every card",`,
    `  "audioScript": "voice-over narration read over the whole video, ${count * 12} to ${count * 16} words, warm and unhurried, no numbers, no URLs",`,
    `  "quotes": [`,
    `    { "text": "the quote itself, one or two sentences, under 200 characters", "attribution": "who said it, or a role such as \\"an old proverb\\"", "accentColor": "#rrggbb" }`,
    `  ]`,
    `}`,
    `Rules: exactly ${count} quotes; every accentColor is the same colour; do not invent a famous person's name for a quote they did not say — when unsure, attribute it to a proverb or a tradition; the narration must not simply read the quotes aloud, it introduces and connects them.`,
  ].join('\n');
}

/**
 * Spec: the opening card plus one scene per quote. The opener carries half the weight of a quote
 * because it holds three words; the quotes share the rest evenly. No `factBindings` anywhere —
 * nothing in this video is a checkable fact, so the Timeline Assembler has nothing to bind.
 */
export function toPackets(out: DirectorOutput): { plan: DirectorPlan; script: AudioScript } {
  const language = out.language.toLowerCase();
  return {
    script: { text: out.audioScript.trim(), language },
    plan: {
      language,
      theme: THEME,
      scenes: [
        { sceneType: TITLE_CARD, weight: 0.5, props: { headline: out.title, subline: out.subtitle, accentColor: out.accentColor } },
        ...out.quotes.map((q) => ({ sceneType: QUOTE, weight: 1, props: { ...q, accentColor: out.accentColor } })),
      ],
    },
  };
}
