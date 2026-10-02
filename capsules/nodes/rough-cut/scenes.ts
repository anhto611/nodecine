import type { Word } from '@/contracts/types/payloads';

export interface Scene {
  /** Seconds from the start of the recording. */
  start: number;
  durationSeconds: number;
  /** What is said in it, as the words came back. */
  said: string;
  words: Word[];
}

export interface CutSettings {
  /** How long a scene should run before a breath in the speech may end it. */
  targetSeconds: number;
  /** No scene is shorter than this, however the person breathes. */
  minSeconds: number;
  /** A gap between two words long enough to be the end of a thought. */
  pauseSeconds: number;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * A recording cut into scenes at the places the speech already stops.
 *
 * Nothing is thrown away and nothing is reordered: the scenes are the recording, one after another,
 * so what is heard always matches what is seen. The cuts land in the silences — halfway through the
 * gap between two words — because that is where a cut is invisible and where the speaker themselves
 * decided one thought had ended.
 *
 * A film of one long shot is hard to watch; a film that cuts mid-word is worse. So a scene ends at the
 * first real pause after it has run long enough, and, when somebody talks without breathing, at the
 * longest gap in the stretch that has piled up.
 */
export function cutIntoScenes(words: Word[], durationSeconds: number, settings: CutSettings): Scene[] {
  const said = words.filter((w) => w.text.trim());
  if (!said.length) return [];
  const { targetSeconds, minSeconds, pauseSeconds } = settings;
  const longest = Math.max(targetSeconds * 1.8, minSeconds + 1);

  const scenes: Scene[] = [];
  let from = 0;
  let firstWord = 0;
  for (let i = 0; i < said.length; i++) {
    const next = said[i + 1];
    const last = i === said.length - 1;
    const gap = next ? Math.max(0, next.start - said[i]!.end) : 0;
    const ran = (next ? next.start : durationSeconds) - from;
    const breath = gap >= pauseSeconds && ran >= targetSeconds;
    const overrun = ran >= longest && gap > 0;
    if (!last && !breath && !overrun) continue;
    // The cut falls in the silence, so neither the word before nor the word after is clipped.
    const to = last ? Math.max(durationSeconds, said[i]!.end) : said[i]!.end + gap / 2;
    const mine = said.slice(firstWord, i + 1);
    if (!last && to - from < minSeconds && scenes.length) continue;
    scenes.push({
      start: round(from),
      durationSeconds: round(Math.max(0.4, to - from)),
      said: mine
        .map((w) => w.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
      words: mine,
    });
    from = to;
    firstWord = i + 1;
  }
  return scenes;
}

/** A few words to call a scene by, taken from what is said in it. */
export function sceneTitle(said: string, words = 5): string {
  const cut = said.split(/\s+/).filter(Boolean).slice(0, words).join(' ');
  return cut.replace(/[.,!?;:]+$/, '') || 'Scene';
}
