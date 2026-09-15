import { BLOCK_ROLES, type BlockRole } from './blocks';

/**
 * A workflow's storyboard guide: how its films are built, written once by the workflow's authors in
 * `storyboard-guide.md`. Its body is read by the model that writes storyboards. A short header above
 * it says what only the workflow knows and the writer's node enforces:
 *
 *   ---
 *   first: hook
 *   last: outro
 *   repeat: 2
 *   ---
 *
 * `first` and `last` are the roles the first and the last scene must play, when the workflow's films need one; `repeat` is
 * how many scenes in a row may play the same block, so films are not cut from one block over and over.
 */

export const GUIDE_FILE = 'storyboard-guide.md';

export interface StoryboardGuide {
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
  const repeat = Number(fields.repeat);
  return { first: asRole(fields.first), last: asRole(fields.last), repeat: Number.isInteger(repeat) && repeat >= 1 ? repeat : undefined, body: header ? source.slice(header[0].length) : source };
}

