import type { CaptionTrack } from '@/core/types/payloads';

/**
 * A caption track as a subtitle file (CORE_CONTRACTS §5.16). Pure, so the shapes below are what a
 * player will actually read, and a test can say so without touching a disk.
 *
 * SubRip and WebVTT are the same idea twice: a cue is a time range and the words spoken in it. They
 * differ in the decimal mark (comma against point), in the numbering (SubRip counts, WebVTT does
 * not), and in the header WebVTT insists on. Everything else here is shared.
 */
export const SUBTITLE_FORMATS = ['srt', 'vtt'] as const;
export type SubtitleFormat = (typeof SUBTITLE_FORMATS)[number];

/** `HH:MM:SS,mmm` for SubRip, `HH:MM:SS.mmm` for WebVTT. Hours are always written, as both ask. */
export function timecode(seconds: number, format: SubtitleFormat): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${format === 'srt' ? ',' : '.'}${pad(ms % 1000, 3)}`;
}

export function toSubtitles(track: CaptionTrack, format: SubtitleFormat): string {
  const blocks = track.cues.map((cue, i) => {
    const line = cue.words.map((w) => w.text).join(' ');
    // A cue that ends before it starts would make a player drop it silently; give it a visible instant.
    const end = Math.max(cue.end, cue.start + 0.04);
    const times = `${timecode(cue.start, format)} --> ${timecode(end, format)}`;
    return format === 'srt' ? `${i + 1}\n${times}\n${line}` : `${times}\n${line}`;
  });
  const body = `${blocks.join('\n\n')}\n`;
  return format === 'vtt' ? `WEBVTT\n\n${body}` : body;
}
