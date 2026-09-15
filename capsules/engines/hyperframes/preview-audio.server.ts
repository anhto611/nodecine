import { parseHTMLContent } from '@hyperframes/core/compiler';
import { exec, findBinary } from '@/server/exec';

/**
 * The sound of a preview as one file on the film's clock, for the player to play from the Studio's
 * own page.
 *
 * The player runs a composition in an opaque-origin iframe, so the composition's code cannot reach
 * the Studio. A click on Play happens in the Studio's page, and a browser does not carry that click
 * into a frame of another origin: the frame's audio is refused, the player takes the sound over in
 * its own page, and with no way to read the frame's media it has nothing to play — the film runs
 * silent until the page is reloaded. Given `audio-src`, it plays that file instead. The composition's
 * top-level audio clips (the voice, cut around silent scenes) are laid on the film's clock here, so
 * the one file sounds the way the film does.
 */

export interface AudioClip {
  /** A file in the project directory. */
  file: string;
  /** Where the clip starts on the film, where it starts in its file, and for how long, in seconds. */
  start: number;
  mediaStart: number;
  duration: number | null;
}

const seconds = (value: string | null): number | null => {
  const n = value === null ? NaN : Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

/** The audio clips an entry plays at its top level, with their sources resolved through its values. */
export function audioClips(entry: string, values: Record<string, unknown>): AudioClip[] {
  const doc = parseHTMLContent(entry);
  const clips: AudioClip[] = [];
  for (const el of Array.from(doc.querySelectorAll('audio[data-start]'))) {
    const bound = el.getAttribute('data-var-src');
    const src = (bound && typeof values[bound] === 'string' && values[bound]) || el.getAttribute('src') || '';
    // Only files in the project: a URL elsewhere is not ours to mix.
    if (!src || /^[a-z]+:|^\/\//i.test(src) || src.split('/').includes('..')) continue;
    clips.push({
      file: src.replace(/^\.\//, '').replace(/^\//, ''),
      start: Math.max(0, seconds(el.getAttribute('data-start')) ?? 0),
      mediaStart: Math.max(0, seconds(el.getAttribute('data-media-start')) ?? 0),
      duration: seconds(el.getAttribute('data-duration')),
    });
  }
  return clips;
}

/** The ffmpeg arguments that lay the clips on the film's clock and write one AAC file. */
export function mixArguments(clips: AudioClip[], dir: string, output: string): string[] {
  const files = [...new Set(clips.map((c) => c.file))];
  const args = ['-v', 'error', '-y'];
  for (const file of files) args.push('-i', `${dir}/${file}`);
  const chains = clips.map((c, i) => {
    const input = files.indexOf(c.file);
    const trim = `atrim=start=${c.mediaStart}${c.duration !== null ? `:duration=${c.duration}` : ''}`;
    const delay = Math.round(c.start * 1000);
    return `[${input}:a]${trim},asetpts=PTS-STARTPTS,adelay=${delay}|${delay}[c${i}]`;
  });
  const mix = clips.length === 1 ? `[c0]anull[out]` : `${clips.map((_, i) => `[c${i}]`).join('')}amix=inputs=${clips.length}:normalize=0:duration=longest[out]`;
  args.push('-filter_complex', [...chains, mix].join(';'), '-map', '[out]', '-c:a', 'aac', '-b:a', '128k', output);
  return args;
}

/**
 * The page without the audio clips that file carries, so the film has one voice: played from the
 * Studio's page, never also from the frame. A clip the file does not carry (a URL elsewhere) stays.
 */
export function withoutMixedAudio(html: string): string {
  return html.replace(/<audio\b[^>]*\bdata-start\b[^>]*>[\s\S]*?<\/audio>/gi, (tag) => {
    const src = /\bsrc\s*=\s*["']([^"']*)["']/i.exec(tag.replace(/\bdata-var-src\s*=\s*["'][^"']*["']/i, ''))?.[1] ?? '';
    return /^[a-z]+:|^\/\//i.test(src) ? tag : '';
  });
}

/** Writes the preview's sound into the project directory; false when there is none, or no ffmpeg to make it. */
export async function writePreviewAudio(entry: string, values: Record<string, unknown>, dir: string, output: string): Promise<boolean> {
  const clips = audioClips(entry, values);
  if (!clips.length) return false;
  const ffmpeg = await findBinary('ffmpeg', 'NODECINE_FFMPEG_BIN');
  if (!ffmpeg) return false;
  const r = await exec(ffmpeg, { args: mixArguments(clips, dir, output), timeoutMs: 120_000 });
  return r.code === 0;
}
