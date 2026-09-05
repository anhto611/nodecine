import { detectLanguage } from './detect-language';

/**
 * Output-language policy for anything that writes a video with a model (CORE_CONTRACTS §5.8).
 *
 * What "auto" means, how two language tags compare, and what a language is called in a picker are
 * the same questions whatever the video is about, so they are answered once here. A caller states
 * only what its own source text is.
 */

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', vi: 'Vietnamese', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', es: 'Spanish',
  fr: 'French', de: 'German', pt: 'Portuguese', id: 'Indonesian', th: 'Thai', ru: 'Russian',
  ar: 'Arabic', hi: 'Hindi',
};

/** The picker's contents: `auto` plus every language this build can name. */
export const OUTPUT_LANGUAGES: string[] = ['auto', ...Object.keys(LANGUAGE_NAMES)];

export const languageName = (code: string): string => LANGUAGE_NAMES[code.toLowerCase()] ?? code;

/** `auto` means the language of the source text; anything else is the user's choice. */
export function resolveOutputLanguage(param: string, sourceText: string): string {
  if (param && param !== 'auto') return param.toLowerCase();
  return detectLanguage(sourceText);
}

/** Compare primary subtags only: a model may answer "en-US" when asked for "en". */
export function sameLanguage(a: string, b: string): boolean {
  return a.toLowerCase().split('-')[0] === b.toLowerCase().split('-')[0];
}
