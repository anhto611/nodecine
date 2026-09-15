import { BLOCK_ROLES, type BlockRole } from './blocks';

/**
 * A workflow's storyboard guide: how its films are built, written once by the workflow's authors in
 * `storyboard-guide.md`. Its body is read by the model that writes storyboards. A short header above
 * it says what only the workflow knows and the writer's node shows or enforces:
 *
 *   ---
 *   hint.vi: Dán link App Store hoặc website, hoặc viết vài câu về app
 *   hint.en: Paste the App Store link or website, or write a few sentences about the app
 *   first: hook
 *   last: outro
 *   repeat: 2
 *   ---
 *
 * `hint` is the placeholder of the box where a person says what the film is about; `first` and `last`
 * are the roles the first and the last scene must play, when the workflow's films need one; `repeat` is
 * how many scenes in a row may play the same block, so films are not cut from one block over and over.
 */

export const GUIDE_FILE = 'storyboard-guide.md';

export interface StoryboardGuide {
  /** The describe-box placeholder by language code; `default` when the header gives one without a language. */
  hint: Record<string, string>;
  first?: BlockRole;
  last?: BlockRole;
  /** How many scenes in a row may play the same block. */
  repeat?: number;
  /** The instructions for the model, without the header. */
  body: string;
}

const asRole = (value: string | undefined): BlockRole | undefined => ((BLOCK_ROLES as readonly string[]).includes(value ?? '') ? value as BlockRole : undefined);

export function readGuide(text: string | undefined): StoryboardGuide {
  const source = text ?? '';
  const header = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  const fields: Record<string, string> = {};
  for (const line of (header?.[1] ?? '').split(/\r?\n/)) {
    const m = /^\s*([a-z][a-z.-]*)\s*:\s*(.*)$/i.exec(line);
    if (m) fields[m[1]!.toLowerCase()] = m[2]!.trim();
  }
  const hint: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'hint') hint.default = value;
    else if (key.startsWith('hint.')) hint[key.slice(5)] = value;
  }
  const repeat = Number(fields.repeat);
  return { hint, first: asRole(fields.first), last: asRole(fields.last), repeat: Number.isInteger(repeat) && repeat >= 1 ? repeat : undefined, body: header ? source.slice(header[0].length) : source };
}

/** The placeholder for a locale: its own, else the one without a language, else none. */
export const guideHint = (guide: StoryboardGuide, locale: string): string | undefined => guide.hint[locale] ?? guide.hint[locale.split('-')[0]!] ?? guide.hint.default;
