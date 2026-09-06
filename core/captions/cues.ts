import type { CaptionTrack, Word } from '../types/payloads';

/**
 * Grouping words into caption lines (CORE_CONTRACTS §2.10). Ported from cutdown's
 * `template/shared/captions.ts`, which earned these rules on real Vietnamese narration.
 *
 * Sentences first, and a sentence that fits is left whole. A line that ends on "và" or in the
 * middle of "một trăm bốn / mươi bảy" is not an unbalanced line, it is a broken phrase, so the
 * layout is a small dynamic programme over break costs rather than a greedy cut every N words.
 */

/** Below this a cue is a fragment, and flashes past before it can be read. */
const CUE_MIN_CHARS = 16;
/** Ends a thought. Closing quote or bracket may follow the mark. */
const STRONG = /[.!?…]["'”’)\]]?$/;
/** Joins one clause to the next — a break here is legal but second choice. */
const WEAK = /[,;:—–]$/;

/**
 * Words that lean on what comes after them, so a break just after one splits a phrase in half.
 * Vietnamese writes numbers out in syllables, which is why the digits are here.
 */
const GLUE_AFTER = new Set(
  (
    'một hai ba bốn năm sáu bảy tám chín mười trăm nghìn ngàn triệu tỷ linh lẻ mươi ' +
    'và hay hoặc của cho với là mà thì ở trong trên dưới từ đến theo về như vì nên ' +
    'nhưng để khi nếu đã sẽ đang rất không chưa các những mỗi cả bị được ' +
    'a an the and or of to in on at for with by from as is are was be'
  ).split(' '),
);
/** Words that lean back on what came before, so a break just before one is bad. */
const GLUE_BEFORE = new Set(('mươi trăm nghìn ngàn triệu tỷ lăm mốt tư nhất rồi luôn nữa thôi ạ nhé đó này kia ấy').split(' '));

const bare = (text: string): string => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
/** Rendered width of a cue, in characters, spaces included. */
const width = (cue: Word[]): number => cue.reduce((n, w) => n + w.text.length, 0) + cue.length - 1;

function breakCost(words: Word[], i: number, widest: number): number {
  const glue = (GLUE_AFTER.has(bare(words[i]!.text)) ? 300 : 0) + (GLUE_BEFORE.has(bare(words[i + 1]!.text)) ? 300 : 0);
  if (STRONG.test(words[i]!.text) || WEAK.test(words[i]!.text)) return glue;
  // A pause is where a phrase ends; the discount is small because a fast sentence has a gap everywhere.
  const gap = words[i + 1]!.start - words[i]!.end;
  return glue + 300 - (gap / widest) * 30;
}

function lineCost(w: number, maxChars: number): number {
  // Squared, so one very short line costs more than two slightly short ones.
  const slack = (maxChars - w) ** 2 / 24;
  return w < CUE_MIN_CHARS ? slack + 120 : slack;
}

/** Lays one sentence out as caption lines, minimising total cost. */
function layout(words: Word[], maxChars: number): Word[][] {
  const n = words.length;
  const gaps = words.slice(0, -1).map((w, i) => words[i + 1]!.start - w.end);
  const widest = Math.max(...gaps, 0.001);
  const best = new Array<number>(n + 1).fill(Infinity);
  const from = new Array<number>(n + 1).fill(0);
  best[0] = 0;
  for (let j = 1; j <= n; j++) {
    for (let i = 0; i < j; i++) {
      if (best[i] === Infinity) continue;
      const w = width(words.slice(i, j));
      // One word longer than a line still has to go somewhere.
      if (w > maxChars && j - i > 1) continue;
      const cost = best[i]! + lineCost(w, maxChars) + (j < n ? breakCost(words, j - 1, widest) : 0);
      if (cost < best[j]!) {
        best[j] = cost;
        from[j] = i;
      }
    }
  }
  const cues: Word[][] = [];
  for (let j = n; j > 0; j = from[j]!) cues.unshift(words.slice(from[j], j));
  return cues;
}

/** Groups words into caption lines: by sentence, then by cost. */
export function toCues(words: Word[], maxChars: number): Word[][] {
  const sentences: Word[][] = [];
  let current: Word[] = [];
  for (const w of words) {
    current.push(w);
    if (STRONG.test(w.text)) {
      sentences.push(current);
      current = [];
    }
  }
  if (current.length) sentences.push(current);
  return sentences.flatMap((sentence) => layout(sentence, maxChars));
}

/**
 * Puts the narration's own words on the aligner's clock. The text that went to TTS is the
 * authoritative text; the aligner only lends its timings, by position when the counts agree and
 * spread by word length across the measured span when they do not.
 */
export function retime(narration: string, heard: Word[]): Word[] {
  const said = narration.trim().split(/\s+/).filter(Boolean);
  if (!said.length || !heard.length) return heard;
  if (said.length === heard.length) return said.map((text, i) => ({ text, start: heard[i]!.start, end: heard[i]!.end }));
  const from = heard[0]!.start;
  const to = heard[heard.length - 1]!.end;
  const span = Math.max(0.2, to - from);
  const weights = said.map((w) => Math.max(1, w.length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let cursor = from;
  return said.map((text, i) => {
    const start = cursor;
    cursor += (weights[i]! / totalWeight) * span;
    return { text, start: Math.round(start * 1000) / 1000, end: Math.round(cursor * 1000) / 1000 };
  });
}

/** Seconds a line stays after its last word, unless the next line starts first. */
const HOLD_SEC = 0.12;

/** Words on the clock → lines on the clock. A line never outlives the next one, so two never show at once. */
export function buildCaptionTrack(words: Word[], o: { maxChars: number }): CaptionTrack {
  const lines = toCues(words, o.maxChars);
  const cues = lines.map((line, i) => {
    const next = lines[i + 1];
    const natural = line[line.length - 1]!.end + HOLD_SEC;
    const end = next ? Math.min(natural, next[0]!.start) : natural;
    return { start: line[0]!.start, end: Math.max(end, line[0]!.start + 0.05), words: line };
  });
  return { cues };
}
