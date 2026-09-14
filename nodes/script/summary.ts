import { CONTENT_KEYS, type ContentKey, type SceneContent } from '@/contracts/types/payloads';

/**
 * What one scene looks like folded to a line (USER_FLOWS §1.9): the first words the voice says,
 * and a chip per thing on screen. The node body shows twenty scenes as twenty of these; the
 * editing happens in the dialog, where there is room for it.
 */
export type SceneChip = { key: ContentKey; count?: number };

/** The opening of the narration, cut at a word so it never ends mid-syllable. */
export function narrationLead(narration: string, max = 48): string {
  const one = narration.replace(/\s+/g, ' ').trim();
  if (one.length <= max) return one;
  const cut = one.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return `${at > max / 2 ? cut.slice(0, at) : cut}…`;
}

/** One chip per content key that carries a value, in vocabulary order; entries say how many. */
export function contentChips(content: SceneContent): SceneChip[] {
  const chips: SceneChip[] = [];
  for (const k of CONTENT_KEYS) {
    const v = content[k];
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    chips.push(k === 'entries' ? { key: k, count: (v as unknown[]).length } : { key: k });
  }
  return chips;
}

/** A scene moved one step; the list is unchanged when the move would leave it. */
export function moveScene<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}
