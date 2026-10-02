import type { Brief } from '@/contracts/types/brief';
import type { Voiceover } from '@/contracts/types/payloads';
import { detectLanguage } from '@/contracts/text/detect-language';

/** What a brief may hold, from `BriefSchema`. Longer than this and it has to be cut down. */
const CAP = 3000;

/**
 * What a film that has already been shot is about: its own words.
 *
 * A brief is what somebody wants a video to be, written before there is one. A recording is the other
 * way round — the film exists, and everything after it is description — so for a film cut from one, the
 * transcript *is* the brief, and asking a person to summarise what they just said is asking them to do
 * work the recording already did.
 *
 * Nothing here is generated: the words are the speaker's own and the language is the one the Caption
 * Sync node heard, or read off the words when even that was left undetermined. Assets has its own model
 * for turning this into picture searches, which is why no second one is put in the way.
 */
export function spokenBrief(voiceover: Voiceover): Brief | undefined {
  const said = (voiceover.words ?? [])
    .map((w) => w.text)
    .join(' ')
    .trim();
  if (!said) return undefined;
  const language = voiceover.language && voiceover.language !== 'und' ? voiceover.language : detectLanguage(said);
  return { about: trim(said), language };
}

/**
 * A transcript cut to what a brief will hold: the opening and the close, with the middle dropped.
 *
 * Those two ends are where somebody says what a video is and what it was for; the middle is the working
 * out. It is a real loss on a long recording — a ten-minute talk loses most of its body, and a picture
 * search will not see whatever was only named in there. Cutting it any more carefully would mean reading
 * it, and reading it means a second model, which is exactly what taking the words directly avoids.
 */
function trim(said: string): string {
  if (said.length <= CAP) return said;
  const gap = ' … ';
  const half = Math.floor((CAP - gap.length) / 2);
  const opening = said.slice(0, half).replace(/\s+\S*$/, '');
  const close = said.slice(said.length - half).replace(/^\S*\s+/, '');
  return `${opening}${gap}${close}`;
}
