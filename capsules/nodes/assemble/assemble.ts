import { COMPOSITION_ENTRY, type Composition } from '@/contracts/types/composition';
import { blockPath, checkBlockValues, declaredVariables } from '@/contracts/storyboard/blocks';
import { ASSETS_DIR, assetProjectPath, type Assets } from '@/contracts/types/assets';
import type { Voiceover, Word } from '@/contracts/types/payloads';
import { layerTrack, type Cue, type Mount, type Storyboard, type StoryboardFrame } from '@/contracts/types/storyboard';

/**
 * Scenes put on the clock. A storyboard says what each frame shows and on which spoken word; a voice
 * says when each word is spoken. This turns the two into HyperFrames files: one sub-composition per
 * frame under `compositions/frames/`, playing the block the frame names with the frame's values or
 * mounting the workflow's components where and when the frame asks, and an `index.html` that plays the frames one after another — each for exactly as long as
 * its own narration — over the composition's shell (its style, its background, whatever runs
 * the whole film). Deterministic: the same storyboard and voice give the same files.
 *
 * The pictures the video is made with come from an Assets node: each is put into the project as
 * `assets/<name>.<ext>`, and a value that names a picture there that does not exist is refused.
 *
 * What the composition provides, besides its blocks and components:
 * - `index.html` with `<!-- nodecine:frames -->` inside its root, where the frames go;
 * - `assemble.json`: `{ slots, overlays, transition }` — named boxes a mount can use, the parts that
 *   run across the film (captions, a channel mark), and the length of a soft transition.
 */

export const FRAMES_MARKER = '<!-- nodecine:frames -->';
export const ASSEMBLY_FILE = 'assemble.json';
export const TIMELINE_FILE = 'timeline.json';
const COMPONENTS_DIR = 'compositions/components/';

type Rect = [number, number, number, number];

export interface AssemblyConfig {
  slots?: Record<string, Rect>;
  /** Parts across the film. `span`: `video` (all of it) or `spoken` (until the last spoken frame ends). */
  overlays?: (Omit<Mount, 'at' | 'until' | 'layer'> & { span?: 'video' | 'spoken'; track?: number })[];
  /** Seconds a soft transition overlaps two frames. */
  transition?: number;
}

export interface Assembly {
  composition: Composition;
  frames: { number: number; title: string; start: number; duration: number; file: string; block?: string }[];
  problems: string[];
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const slug = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'frame';
const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/[.,:;!?"'“”‘’()…]+$/g, '').replace(/^[("'“‘]+/g, '');
const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#39;');

/** Where each spoken word of a frame falls, in seconds from the frame's start. */
interface FrameWords { words: { text: string; at: number }[]; duration: number }

/** The words of a spoken frame, from the voice when it timed them, else spread evenly over an estimate. */
function wordsFor(frame: StoryboardFrame, voice: Voiceover | undefined, segment: { start: number; durationSeconds: number } | undefined): FrameWords {
  if (voice && segment) {
    const end = segment.start + segment.durationSeconds;
    const timed = (voice.words ?? []).filter((w: Word) => w.start >= segment.start - 0.05 && w.start < end);
    if (timed.length) return { words: timed.map((w) => ({ text: w.text, at: Math.max(0, w.start - segment.start) })), duration: segment.durationSeconds };
  }
  const texts = (frame.voiceover ?? '').split(/\s+/).filter(Boolean);
  const duration = segment?.durationSeconds ?? frame.durationSeconds ?? Math.max(2, texts.length * 0.38 + 0.6);
  return { words: texts.map((text, i) => ({ text, at: (i / Math.max(1, texts.length)) * (duration - 0.4) })), duration };
}

/** A cue in seconds from the frame's start: a number as it is, `@word` (or `@two words`) where it is said. */
function cueSeconds(cue: Cue, words: FrameWords['words'], after: number): number | string {
  if (typeof cue === 'number') return cue;
  if (!cue.startsWith('@')) return `"${cue}" is neither seconds nor an @word`;
  const wanted = cue.slice(1).trim().split(/\s+/).map(norm);
  for (let i = 0; i < words.length; i++) {
    if (words[i]!.at < after - 0.001) continue;
    if (wanted.every((w, j) => words[i + j] && (norm(words[i + j]!.text) === w || norm(words[i + j]!.text).startsWith(w)))) return words[i]!.at;
  }
  // A cue before `after` still counts: two parts may land on the same word.
  for (let i = 0; i < words.length; i++) {
    if (wanted.every((w, j) => words[i + j] && norm(words[i + j]!.text).startsWith(w))) return words[i]!.at;
  }
  return `"${cue.slice(1)}" is not said in this frame`;
}

/** The component's own variable declarations, to know which values are image paths and more. */
const hasComponent = (files: Record<string, string>, name: string) => files[`${COMPONENTS_DIR}${name}.html`] !== undefined;

function clipTag(id: string, mount: { component: string; src?: string; rect: Rect; values: Record<string, unknown>; start: number; duration: number; track: number }): string {
  const [left, top, width, height] = mount.rect;
  return `  <div id="${id}" class="clip" style="position: absolute; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px;"
    data-composition-id="${mount.component}" data-composition-src="${mount.src ?? `${COMPONENTS_DIR}${mount.component}.html`}"
    data-variable-values='${escapeAttr(JSON.stringify(mount.values))}'
    data-start="${round(mount.start)}" data-duration="${round(mount.duration)}" data-track-index="${mount.track}" data-width="${width}" data-height="${height}"></div>`;
}

const SOFT = new Set(['crossfade', 'blur-crossfade']);

function frameFile(id: string, frame: StoryboardFrame, width: number, height: number, duration: number, clips: string[], entrance: string | undefined, overlap: number): string {
  const enter = entrance === 'blur-crossfade'
    ? `tl.fromTo(root, { opacity: 0, filter: 'blur(20px)' }, { opacity: 1, filter: 'blur(0px)', duration: ${overlap}, ease: 'power2.out' }, 0);`
    : entrance === 'crossfade'
      ? `tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: ${overlap}, ease: 'power1.inOut' }, 0);`
      : '';
  return `<!doctype html>
<html lang="vi" data-composition-id="${id}" data-composition-duration="${round(duration)}">
  <!--
    Frame ${frame.number} — ${frame.title.replace(/--/g, '—')}
    ${(frame.scene ?? '').replace(/--/g, '—')}
    Written by the Ráp Cảnh node from the storyboard; edit the storyboard, not this file.
  -->
  <head>
    <meta charset="UTF-8" />
    <title>Frame ${frame.number}</title>
  </head>
  <body>
    <template>
      <div id="root" data-composition-id="${id}" data-duration="${round(duration)}" data-width="${width}" data-height="${height}">
        <style>
          [data-composition-id="${id}"] { position: absolute; inset: 0; overflow: visible; }
        </style>
${clips.join('\n')}
        <script>
          (function () {
            // By its id, not #root: the preview may write this frame straight into the page.
            var root = document.querySelector('[data-composition-id="${id}"]');
            var tl = gsap.timeline({ paused: true });
            ${enter}
            tl.set({}, {}, ${round(duration)});
            tl.seek(0);
            window.__timelines = window.__timelines || {};
            window.__timelines['${id}'] = tl;
          })();
        </script>
      </div>
    </template>
  </body>
</html>
`;
}

/** The storyboard, the composition that styles it and, when there is one, the voice that times it: a playable project. */
export function assemble(kit: Composition, storyboard: Storyboard, voice: Voiceover | undefined, assets?: Assets): Assembly {
  const problems: string[] = [];
  const media: Composition['media'] = { ...kit.media };
  for (const asset of assets?.items ?? []) media[assetProjectPath(asset)] = asset.url;
  // Every `assets/…` a value names, at any depth, must be a picture the project holds.
  const checkAssets = (value: unknown, label: string) => {
    if (Array.isArray(value)) value.forEach((v) => checkAssets(v, label));
    else if (value && typeof value === 'object') Object.values(value).forEach((v) => checkAssets(v, label));
    else if (typeof value === 'string' && value.startsWith(ASSETS_DIR) && media[value] === undefined && kit.files[value] === undefined) {
      const names = (assets?.items ?? []).map(assetProjectPath);
      problems.push(`${label}: no asset ${value} (${names.length ? `there are ${names.join(', ')}` : 'no Assets node gives any'})`);
    }
  };
  const shell = kit.files[COMPOSITION_ENTRY] ?? '';
  if (!shell.includes(FRAMES_MARKER)) problems.push(`the composition's index.html has no ${FRAMES_MARKER} where the frames go`);
  let config: AssemblyConfig = {};
  try { config = kit.files[ASSEMBLY_FILE] ? JSON.parse(kit.files[ASSEMBLY_FILE]!) as AssemblyConfig : {}; } catch (e) { problems.push(`${ASSEMBLY_FILE} does not parse: ${e instanceof Error ? e.message : String(e)}`); }
  const slots = config.slots ?? {};
  const overlap = Math.max(0, Math.min(1.5, config.transition ?? 0.4));
  const { width, height } = kit;
  const rectOf = (box: Mount['box'], where: string): Rect | null => {
    if (Array.isArray(box)) return box as Rect;
    const slot = slots[box];
    if (!slot) { problems.push(`${where}: no slot named "${box}" (the composition has ${Object.keys(slots).join(', ') || 'none'})`); return null; }
    return slot;
  };

  const spoken = storyboard.frames.filter((f) => f.voiceover);
  const segments = voice ? (voice.segments ?? [{ start: 0, durationSeconds: voice.durationSeconds }]) : [];
  if (voice && segments.length !== spoken.length) {
    problems.push(`the voice has ${segments.length} segments but the storyboard has ${spoken.length} spoken frames: voice the storyboard's own narration`);
  }

  const files: Record<string, string> = Object.fromEntries(Object.entries(kit.files).filter(([k]) => !k.startsWith('compositions/frames/')));
  const clips: string[] = [];
  const timeline: { text: string; start: number; end: number }[] = [];
  const placed: Assembly['frames'] = [];
  let cursor = 0;
  let spokenIndex = 0;
  let spokenEnd = 0;
  const voiceRuns: { filmStart: number; mediaStart: number; duration: number }[] = [];
  // Where each frame sits on the film and when its words are said there, for the layers over them.
  const onFilm: { start: number; duration: number; words: FrameWords['words'] }[] = [];

  storyboard.frames.forEach((frame, i) => {
    const where = `frame ${frame.number}`;
    const segment = frame.voiceover ? segments[spokenIndex] : undefined;
    const fw = frame.voiceover ? wordsFor(frame, voice, segment) : { words: [], duration: frame.durationSeconds ?? 3 };
    const duration = fw.duration;
    const soft = i > 0 && SOFT.has(frame.transitionIn ?? '');
    const start = soft ? Math.max(0, cursor - overlap) : cursor;
    const length = duration + (cursor - start);
    const id = `frame-${String(frame.number).padStart(2, '0')}`;
    const file = `compositions/frames/${String(frame.number).padStart(2, '0')}-${slug(frame.title)}.html`;

    const offset = cursor - start;
    // `@word` values (or comma lists of them), at any depth of a list or an object, as seconds from
    // `from`, a moment of the frame's narration.
    const resolveValues = (values: Record<string, unknown>, from: number, label: string): Record<string, unknown> => {
      const resolve = (value: unknown, where: string): unknown => {
        if (Array.isArray(value)) return value.map((item, i) => resolve(item, `${where}[${i}]`));
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, `${where}.${k}`)]));
        if (typeof value !== 'string' || !/^@/.test(value.trim())) return value;
        const parts = value.split(',').map((p) => p.trim());
        const secs = parts.map((p) => (p ? cueSeconds(p, fw.words, Math.max(0, from)) : 0));
        const bad = secs.find((x) => typeof x === 'string');
        if (bad) { problems.push(`${label}, ${where}: ${bad}`); return value; }
        const rel = (secs as number[]).map((x) => round(Math.max(0, x - from)));
        return parts.length > 1 ? rel.join(',') : rel[0];
      };
      return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, resolve(value, key)]));
    };

    // The frame's parts: the block it plays, for all of it, or its mounts, each on its cue, in the order written.
    const inner: string[] = [];
    if (frame.block) {
      const label = `${where}, ${frame.block}`;
      const html = kit.files[blockPath(frame.block)];
      if (html === undefined) problems.push(`${label}: the composition has no block ${frame.block}`);
      else {
        const declared = declaredVariables(html);
        // The block starts with the frame's clip, which a soft transition starts early: its cues count from there.
        checkAssets(frame.values, label);
        const values = resolveValues(frame.values, -offset, label);
        if (declared.some((v) => v.id === 'seconds')) values.seconds = round(length);
        const checked = checkBlockValues(label, values, declared);
        problems.push(...checked.problems);
        Object.assign(values, checked.values);
        const root = /<template[^>]*>[\s\S]*?(<[a-z][^>]*\bdata-composition-id\s*=[^>]*>)/i.exec(html)?.[1] ?? '';
        const blockId = /\bdata-composition-id\s*=\s*["']([^"']+)/i.exec(root)?.[1];
        if (blockId !== frame.block) problems.push(`${label}: its root's data-composition-id must be "${frame.block}", its file name`);
        else inner.push(clipTag(`${id}-block`, { component: frame.block, src: blockPath(frame.block), rect: [0, 0, width, height], values, start: 0, duration: length, track: 1 }));
      }
    }
    frame.mounts.forEach((mount, j) => {
      const label = `${where}, ${mount.component}`;
      checkAssets(mount.values, label);
      if (!hasComponent(kit.files, mount.component)) { problems.push(`${label}: the composition has no component ${mount.component}`); return; }
      const rect = rectOf(mount.box, label);
      const at = cueSeconds(mount.at ?? 0, fw.words, 0);
      const until = cueSeconds(mount.until ?? duration, fw.words, typeof at === 'number' ? at : 0);
      if (typeof at === 'string') problems.push(`${label}: ${at}`);
      if (typeof until === 'string') problems.push(`${label}: ${until}`);
      if (!rect || typeof at === 'string' || typeof until === 'string') return;
      const from = Math.min(at, duration - 0.2);
      const to = Math.max(from + 0.2, Math.min(until, duration));
      const values = { ...resolveValues(mount.values, from, label), seconds: round(to - from) };
      inner.push(clipTag(`${id}-${j + 1}`, { component: mount.component, rect, values, start: from + offset, duration: to - from, track: mount.layer ?? j + 1 }));
    });

    files[file] = frameFile(id, frame, width, height, length, inner.map((c) => c.replace(/^ {2}/gm, '        ')), soft ? frame.transitionIn : undefined, overlap);
    clips.push(`  <div id="${id}" class="clip" style="position: absolute; left: 0; top: 0; width: ${width}px; height: ${height}px;"
    data-composition-id="${id}" data-composition-src="${file}"
    data-start="${round(start)}" data-duration="${round(length)}" data-track-index="${1 + (i % 2)}" data-width="${width}" data-height="${height}"></div>`);

    if (frame.voiceover) {
      if (voice && segment) {
        // Frames spoken back to back share one stretch of the voice. Cutting the file at every frame
        // made the browser play the first word of a frame twice: two audio elements on one file never
        // hand over to the millisecond, and a frame's first word starts right at its cut. The voice
        // is only cut where a silent frame sits between two spoken ones, and there it is silent.
        const run = voiceRuns.at(-1);
        if (run && Math.abs(run.filmStart + run.duration - cursor) < 0.001 && Math.abs(run.mediaStart + run.duration - segment.start) < 0.01) {
          run.duration = segment.start + segment.durationSeconds - run.mediaStart;
        } else {
          voiceRuns.push({ filmStart: cursor, mediaStart: segment.start, duration: segment.durationSeconds });
        }
      }
      for (const w of fw.words) timeline.push({ text: w.text, start: round(cursor + w.at), end: 0 });
      spokenIndex++;
      spokenEnd = cursor + duration;
    }
    placed.push({ number: frame.number, title: frame.title, start: round(start), duration: round(length), file, ...(frame.block ? { block: frame.block } : {}) });
    onFilm.push({ start: cursor, duration, words: fw.words });
    cursor += duration;
  });

  // A word lasts until the next one starts, or a little past its own start at the end of a frame.
  timeline.forEach((w, i) => { const next = timeline[i + 1]; w.end = round(next && next.start - w.start < 1.2 ? next.start : w.start + 0.5); });

  voiceRuns.forEach((run, k) => {
    clips.push(`  <audio id="voice-${k + 1}" data-start="${round(run.filmStart)}" data-duration="${round(run.duration)}" data-media-start="${round(run.mediaStart)}" data-track-index="${20 + (k % 2)}" data-var-src="voiceover"></audio>`);
  });

  const total = round(cursor);

  // Layers: an overlay block from a moment of one frame to a moment of a later one, on its own track
  // above the frames. Its values' `@word`s are looked for in all the frames it runs over.
  (storyboard.layers ?? []).forEach((layer, i) => {
    const label = `layer ${layer.number}, ${layer.block}`;
    const html = kit.files[blockPath(layer.block)];
    if (html === undefined) { problems.push(`${label}: the composition has no block ${layer.block}`); return; }
    const first = onFilm[layer.from - 1], last = onFilm[layer.to - 1];
    if (!first || !last || layer.from > layer.to) { problems.push(`${label}: frames ${layer.from} to ${layer.to} are not in the film`); return; }
    const inFrame = (cue: Cue | undefined, frame: typeof first, edge: number) => {
      if (cue === undefined) return edge;
      const at = cueSeconds(cue, frame.words, 0);
      if (typeof at === 'string') { problems.push(`${label}: ${at.replace('this frame', `frame ${frame === first ? layer.from : layer.to}`)}`); return edge; }
      return frame.start + at;
    };
    const from = inFrame(layer.start, first, first.start);
    const to = Math.max(from + 0.5, inFrame(layer.end, last, last.start + last.duration));
    const words = onFilm.slice(layer.from - 1, layer.to).flatMap((f) => f.words.map((w) => ({ text: w.text, at: f.start + w.at })));
    checkAssets(layer.values, label);
    const resolve = (value: unknown, where: string): unknown => {
      if (Array.isArray(value)) return value.map((item, k) => resolve(item, `${where}[${k}]`));
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, `${where}.${k}`)]));
      if (typeof value !== 'string' || !/^@/.test(value.trim())) return value;
      const parts = value.split(',').map((p) => p.trim());
      const secs = parts.map((p) => cueSeconds(p, words, from));
      const bad = secs.find((x) => typeof x === 'string');
      if (bad) { problems.push(`${label}, ${where}: ${String(bad).replace('this frame', `frames ${layer.from}–${layer.to}`)}`); return value; }
      const rel = (secs as number[]).map((x) => round(Math.max(0, x - from)));
      return parts.length > 1 ? rel.join(',') : rel[0];
    };
    const values: Record<string, unknown> = Object.fromEntries(Object.entries(layer.values).map(([k, v]) => [k, resolve(v, k)]));
    const declared = declaredVariables(html);
    if (declared.some((v) => v.id === 'seconds')) values.seconds = round(to - from);
    const checked = checkBlockValues(label, values, declared);
    problems.push(...checked.problems);
    clips.push(clipTag(`layer-${layer.number}`, { component: layer.block, src: blockPath(layer.block), rect: [0, 0, width, height], values: { ...values, ...checked.values }, start: from, duration: to - from, track: layerTrack(layer, i) }));
  });
  (config.overlays ?? []).forEach((overlay, i) => {
    const label = `overlay ${overlay.component}`;
    if (!hasComponent(kit.files, overlay.component)) { problems.push(`${label}: the composition has no component ${overlay.component}`); return; }
    const rect = rectOf(overlay.box, label);
    if (!rect) return;
    const duration = overlay.span === 'spoken' ? Math.max(0.5, spokenEnd) : total;
    clips.push(clipTag(`overlay-${i + 1}`, { component: overlay.component, rect, values: { ...overlay.values, seconds: round(duration) }, start: 0, duration, track: overlay.track ?? 10 + i }));
  });

  files[COMPOSITION_ENTRY] = shell.replace(FRAMES_MARKER, `${FRAMES_MARKER}\n${clips.join('\n')}`);
  files[TIMELINE_FILE] = JSON.stringify({ durationSeconds: total, frames: placed, words: timeline });

  return {
    composition: { ...kit, files, media, values: { ...kit.values, videoSeconds: total } },
    frames: placed,
    problems,
  };
}
