/**
 * A sample video, read: what a workflow's agent is told about a film someone wants more of.
 *
 * The reading is rea-video's (https://github.com/JuneYaooo/rea-video, Apache-2.0), run offline: its
 * shots and the beats inside them, how captions move, what the sound is and what was said. NodeCine
 * adds one still per segment, which the agent looks at with the workflow's model — that reads on-screen
 * text better than OCR does, Vietnamese above all. From both the agent picks the template closest to
 * the sample and sets it up.
 */

export interface SampleSegment {
  start: number;
  end: number;
  /** How it began: the start, a cut or transition between shots, or a beat inside a shot (a new card in a motion-graphics film). */
  by: 'start' | 'cut' | 'beat';
}

export interface SampleFrame {
  /** Seconds into the video. */
  t: number;
  /** The still, kept with the uploads (`/api/assets/…`). */
  url: string;
}

export interface SampleProfile {
  /** Content hash of the file: the same video is read once. */
  id: string;
  name: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  segments: SampleSegment[];
  frames: SampleFrame[];
  /** How the film was made, as the analyzer judges it (screen recording, live action, code render…). */
  made?: string;
  /** How captions and on-screen text look and move. */
  captions?: string[];
  /** Transitions between shots, by kind. */
  transitions?: Record<string, number>;
  audio: { present: boolean; musicBpm?: number; music?: string };
  speech?: { language: string; lines: { start: number; end: number; text: string }[] };
}

/**
 * The languages rea-video's transcriber (SenseVoice) hears. Speech in any other — Vietnamese above all —
 * comes back as confident nonsense labelled one of these or `yue`, so a transcript is trusted only in
 * these; Cantonese is left out because Vietnamese is what it is mistaken for.
 */
export const HEARD_LANGUAGES = ['zh', 'en', 'ja', 'ko'];
export const speechTrusted = (p: SampleProfile): boolean => !!p.speech?.lines.length && HEARD_LANGUAGES.includes(p.speech.language);

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const median = (list: number[]) => {
  if (!list.length) return 0;
  const s = [...list].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

/** The numbers an editor reads off a sample, worked out from its segments. */
export function sampleStats(p: SampleProfile) {
  const lengths = p.segments.map((s) => s.end - s.start);
  return {
    orientation: p.width === p.height ? 'square' : p.width > p.height ? 'landscape' : 'portrait',
    segments: p.segments.length,
    medianSegmentSeconds: round(median(lengths)),
    shortestSegmentSeconds: round(lengths.length ? Math.min(...lengths) : 0),
    longestSegmentSeconds: round(lengths.length ? Math.max(...lengths) : 0),
    changesPerMinute: round((p.segments.length - 1) / Math.max(p.durationSeconds / 60, 1 / 60)),
  };
}

/** The sample as the agent reads it: a few lines of measurements, how it moves, and what was said. */
export function describeSample(p: SampleProfile): string {
  const s = sampleStats(p);
  const lines = [
    `"${p.name}": ${round(p.durationSeconds)} s, ${p.width}×${p.height} (${s.orientation}), ${round(p.fps, 0)} fps`,
    `${s.segments} segments, median ${s.medianSegmentSeconds} s (shortest ${s.shortestSegmentSeconds} s, longest ${s.longestSegmentSeconds} s), ${s.changesPerMinute} changes a minute`,
    `segments (start–end s): ${p.segments.map((x) => `${round(x.start)}–${round(x.end)}${x.by === 'cut' ? ' (cut)' : ''}`).join(', ')}`,
  ];
  if (p.made) lines.push(`made with (a guess from pixel statistics, unconfirmed — trust the stills over it): ${p.made}`);
  if (p.transitions && Object.keys(p.transitions).length)
    lines.push(
      `transitions: ${Object.entries(p.transitions)
        .map(([k, n]) => `${k}×${n}`)
        .join(', ')}`,
    );
  if (p.captions?.length) lines.push(`captions: ${p.captions.join('; ')}`);
  lines.push(!p.audio.present ? 'sound: none' : `sound: ${p.audio.music ?? 'music unknown'}${p.audio.musicBpm ? `, ${p.audio.musicBpm} BPM` : ''}`);
  if (p.speech && speechTrusted(p)) {
    const words = p.speech.lines.reduce((n, l) => n + l.text.split(/\s+/).filter(Boolean).length, 0);
    lines.push(
      `speech (${p.speech.language || 'language unknown'}, ${words} words, ${round(words / Math.max(p.durationSeconds / 60, 1 / 60), 0)} words a minute):\n${p.speech.lines.map((l) => `  ${round(l.start)}–${round(l.end)} s: ${l.text}`).join('\n')}`,
    );
  } else if (p.audio.present)
    lines.push(
      p.speech?.lines.length
        ? `speech: there is speech, but not in a language the transcriber knows (it hears Chinese, English, Japanese and Korean) — its words are unknown; judge the narration from the stills and captions`
        : 'speech: none heard',
    );
  return lines.join('\n');
}
