import { detectLanguage } from './detect-language';

/**
 * Output-language policy for anything that writes a video with a model.
 *
 * What "auto" means, how two language tags compare, and what a language is called in a picker are
 * the same questions whatever the video is about, so they are answered once here. A caller states
 * only what its own source text is.
 */

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  vi: 'Vietnamese',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  th: 'Thai',
  id: 'Indonesian',
  ms: 'Malay',
  fil: 'Filipino',
  km: 'Khmer',
  lo: 'Lao',
  my: 'Burmese',
  hi: 'Hindi',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  ur: 'Urdu',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
  cs: 'Czech',
  sk: 'Slovak',
  hu: 'Hungarian',
  ro: 'Romanian',
  bg: 'Bulgarian',
  el: 'Greek',
  ru: 'Russian',
  uk: 'Ukrainian',
  sv: 'Swedish',
  da: 'Danish',
  nb: 'Norwegian',
  fi: 'Finnish',
  tr: 'Turkish',
  ar: 'Arabic',
  he: 'Hebrew',
  fa: 'Persian',
  sw: 'Swahili',
};

/** The picker's contents: `auto` plus every language this build can name. */
export const OUTPUT_LANGUAGES: string[] = ['auto', ...Object.keys(LANGUAGE_NAMES)];

export const languageName = (code: string): string => LANGUAGE_NAMES[code.toLowerCase()] ?? code;

/**
 * `auto` means the language of the source text, read without its web addresses (a link's letters
 * would count as English); anything else is the user's choice. Text with no language to read is English.
 */
export function resolveOutputLanguage(param: string, sourceText: string): string {
  if (param && param !== 'auto') return param.toLowerCase();
  return detectLanguage(sourceText.replace(/https?:\/\/\S+/gi, ' '));
}

/** Compare primary subtags only: a model may answer "en-US" when asked for "en". */
export function sameLanguage(a: string, b: string): boolean {
  return a.toLowerCase().split('-')[0] === b.toLowerCase().split('-')[0];
}
