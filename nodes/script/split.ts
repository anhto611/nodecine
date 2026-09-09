/**
 * Cutting a pasted script into scenes (CORE_CONTRACTS §5.2).
 *
 * Typing a scene at a time is the wrong shape for how people write: a script arrives as one block
 * of prose, and the app should take it that way. Mechanical, and deliberately so — no model is
 * consulted and not a character is changed, so what comes out is what was pasted, only divided.
 *
 * The rule is the person's to pick, because only they know how they wrote it. Blank lines are the
 * usual answer, and a paragraph is a beat for most people; a list pasted from notes wants one line
 * per scene; a single dense paragraph wants sentences.
 */
export const SPLIT_RULES = ['blank-line', 'line', 'sentence'] as const;
export type SplitRule = (typeof SPLIT_RULES)[number];

/**
 * Sentence ends: a full stop, question or exclamation mark, or an ellipsis, followed by space and
 * something that starts a new sentence. Abbreviations are the known hole — `v.v.` and `T.P.` split
 * where they should not — which is why the rule is one of three and not the only one.
 */
const SENTENCE_END = /(?<=[.!?…])\s+(?=\S)/u;

export function splitScript(text: string, rule: SplitRule): string[] {
  const body = text.replace(/\r\n?/g, '\n').trim();
  if (!body) return [];
  const parts =
    rule === 'blank-line' ? body.split(/\n\s*\n+/)
    : rule === 'line' ? body.split('\n')
    : body.split(SENTENCE_END);
  return parts.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
