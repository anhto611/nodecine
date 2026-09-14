import { gsap } from 'gsap';
import { beatClipsOf, type CodeClip, type VideoIR } from '@/contracts/types/ir';
import { BIND_SCRIPT, SCENE_MOUNT, captionLine, captionStyleOf, esc, sceneMarkup, scopedCss, sourceForFormat } from '@/contracts/visual/scene-markup';

/**
 * The `html-gsap` format inside Remotion: the same scene machinery HyperFrames runs, driven by
 * Remotion's frame instead of the HyperFrames runtime. `prepareFilm` turns the IR into what each
 * clip needs, pure; `SceneInstance` mounts one clip's markup in the DOM, runs its scripts through
 * the shared `mountScene`, and is seeked to a second of the scene on every frame. No React here,
 * so a jsdom test can drive it.
 */

export interface PreparedCue { id: string; show: number; hide: number; style: 'karaoke' | 'reveal'; words: { id: string; text: string; at: number }[] }
export interface PreparedScene {
  id: string;
  index: number;
  /** Seconds on the film's clock. */
  start: number;
  duration: number;
  html: string;
  css: string;
  scripts: string[];
  facts: Record<string, unknown>;
  words: { text: string; start: number }[];
  cues: PreparedCue[];
  /** Whether this clip is one of the beats (the scenes), as opposed to a layer's drawing. */
  beat: boolean;
  /** Frames this clip stays mounted past its own end, for the transition into the next beat. */
  overlapFrames: number;
  /** The transition into this clip, and out of it, when it is a beat clip. */
  transitionIn: { name: string; seconds: number } | null;
  transitionOut: { name: string; seconds: number; atFrame: number } | null;
}
export interface PreparedFilm {
  vars: Record<string, unknown>;
  beats: (VideoIR['beats'][number] & { start: number; duration: number })[];
  analysis: Record<string, unknown>;
  scenes: PreparedScene[];
  /** The film's style sheet and the caption band, as HyperFrames lays them out. */
  defaultBand: boolean;
}

/** Everything the clips need, once per film. `analysis` is filled in by the caller that can read media URLs. */
export function prepareFilm(ir: VideoIR, mediaBaseUrl = ''): PreparedFilm {
  const fps = ir.meta.fps;
  const beatByClip = new Map(ir.beats.map((b) => [b.clipId, b] as const));
  const beatClips = beatClipsOf(ir);
  const allCues = ir.captions?.cues ?? [];
  const overrides = new Map((ir.transitions.at ?? []).map((t) => [t.afterClipId, t] as const));
  const transitionAfter = (beatIndex: number) => {
    if (beatIndex >= ir.beats.length - 1) return null;
    const tr = overrides.get(ir.beats[beatIndex]!.clipId) ?? ir.transitions.default;
    return tr.name === 'cut' ? null : { name: tr.name, seconds: tr.seconds };
  };
  let extra = beatClips.length;
  const scenes: PreparedScene[] = [];
  let defaultBand = false;
  ir.tracks.forEach((track) => {
    track.clips.forEach((c) => {
      if (c.kind !== 'code') return;
      const clip = c as CodeClip;
      const beat = beatByClip.get(clip.id);
      const start = clip.startFrame;
      const end = clip.startFrame + clip.durationInFrames;
      const hearFrom = beat ? beat.startFrame : start;
      const hearTo = beat ? beat.startFrame + beat.durationInFrames : end;
      const si = beat ? beat.index : extra++;
      const source = sourceForFormat(clip.format, clip.source, { loop: clip.loop });
      const bare = sceneMarkup(source, { withCaptions: !!ir.captions && !!beat, start: start / fps, duration: clip.durationInFrames / fps });
      const style = captionStyleOf(bare.captionSlot?.tag ?? '');
      const cues: PreparedCue[] = beat
        ? allCues.map((cue, ci) => ({ cue, ci })).filter(({ cue }) => cue.startFrame < hearTo && cue.startFrame + cue.durationInFrames > hearFrom).map(({ cue, ci }) => ({
            id: `nc-cap-${si}-${ci}`,
            show: cue.startFrame / fps,
            hide: (cue.startFrame + cue.durationInFrames) / fps,
            style,
            words: cue.words.map((w, wi) => ({ id: `nc-cap-${si}-${ci}-w${wi}`, text: w.text, at: w.startFrame / fps })),
          }))
        : [];
      const words = allCues.flatMap((cue) => cue.words).filter((w) => w.startFrame >= hearFrom && w.startFrame < hearTo).map((w) => ({ text: w.text, start: (w.startFrame - start) / fps }));
      const scene = sceneMarkup(source, { captionsHtml: cues.map((cue) => captionLine(cue.id, cue.words, style)).join(''), withCaptions: !!ir.captions && !!beat, start: start / fps, duration: clip.durationInFrames / fps });
      if (beat && !scene.captionSlot) defaultBand = true;
      const tIn = beat && beat.index > 0 ? transitionAfter(beat.index - 1) : null;
      const tOut = beat ? transitionAfter(beat.index) : null;
      const nextBeat = beat ? ir.beats[beat.index + 1] : undefined;
      scenes.push({
        id: clip.id,
        index: si,
        start: start / fps,
        duration: clip.durationInFrames / fps,
        // A render's Chrome is pointed at the app by an absolute origin; the scenes name files by app path.
        html: mediaBaseUrl ? scene.html.replace(/(src=["'])\/api\//g, `$1${mediaBaseUrl}/api/`) : scene.html,
        css: scopedCss(`[data-scene="${esc(clip.id)}"]`, scene.styles.join('\n')),
        scripts: scene.scripts,
        facts: clip.facts ?? {},
        words,
        cues,
        beat: !!beat,
        overlapFrames: tOut ? Math.min(Math.round(tOut.seconds * fps), ir.meta.totalDurationInFrames - end) : 0,
        transitionIn: tIn,
        transitionOut: tOut && nextBeat ? { ...tOut, atFrame: nextBeat.startFrame } : null,
      });
    });
  });
  return {
    vars: ir.vars ?? {},
    beats: ir.beats.map((b) => ({ ...b, start: b.startFrame / fps, duration: b.durationInFrames / fps })),
    analysis: {},
    scenes,
    defaultBand,
  };
}

/**
 * What a scene of the other two formats reaches for by name — `lottie`, `THREE` — put on the window
 * the way the HyperFrames page inlines them, and only for a film that uses the format: lottie-web
 * touches a canvas the moment it loads, which a test's DOM does not have and a film of plain scenes
 * does not need.
 */
export async function loadFormatLibs(ir: Pick<VideoIR, 'tracks'>): Promise<void> {
  const formats = new Set(ir.tracks.flatMap((t) => t.clips.flatMap((c) => (c.kind === 'code' ? [c.format] : []))));
  const w = window as unknown as { lottie?: unknown; THREE?: unknown };
  if (formats.has('lottie') && !w.lottie) w.lottie = (await import('lottie-web')).default;
  if (formats.has('html-three') && !w.THREE) w.THREE = await import('three');
}

type MountScene = (g: typeof gsap, root: HTMLElement, scene: PreparedScene, film: { vars: unknown; beats: unknown; analysis: unknown }, unwrap: WeakMap<object, object>) => gsap.core.Timeline[];
let mountFn: MountScene | null = null;

/** The shared mount function, compiled once from the core's script; `window.__nodecineBind` with it. */
function mountScene(): MountScene {
  if (!mountFn) {
    if (!(window as unknown as { __nodecineBind?: unknown }).__nodecineBind) new Function(BIND_SCRIPT)();
    mountFn = new Function('gsap', `${SCENE_MOUNT}\nreturn mountScene;`)(gsap) as MountScene;
  }
  return mountFn;
}

/** One mounted scene: its scripts' timelines and its captions on one paused master, seeked by the frame. */
export class SceneInstance {
  readonly master: gsap.core.Timeline;

  constructor(root: HTMLElement, scene: PreparedScene, film: Pick<PreparedFilm, 'vars' | 'beats' | 'analysis'>) {
    const unwrap = new WeakMap<object, object>();
    const timelines = mountScene()(gsap, root, scene, film, unwrap);
    this.master = gsap.timeline({ paused: true });
    timelines.forEach((tl) => { tl.paused(false); this.master.add(tl, 0); });
    // Captions on the scene's own clock; a line that began in the previous beat is up from the start.
    for (const cue of scene.cues) {
      const line = root.querySelector<HTMLElement>(`#${cue.id}`);
      if (!line) continue;
      this.master.set(line, { autoAlpha: 1 }, Math.max(0, cue.show - scene.start));
      this.master.set(line, { autoAlpha: 0 }, Math.max(0, cue.hide - scene.start));
      for (const w of cue.words) {
        const el = root.querySelector<HTMLElement>(`#${w.id}`);
        if (!el) continue;
        const at = Math.max(0, w.at - scene.start);
        if (cue.style === 'reveal') this.master.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, at);
        else this.master.set(el, { color: 'var(--caption-on, var(--accent))' }, at);
      }
    }
    this.master.set({}, {}, scene.duration);
  }

  /** Show the scene as it is `seconds` into itself. */
  seek(seconds: number): void {
    this.master.seek(Math.max(0, Math.min(this.master.duration(), seconds)), false);
  }

  dispose(): void {
    this.master.kill();
  }
}

/**
 * Mount one scene into an element and keep it mounted.
 *
 * The markup is written here rather than through React's `dangerouslySetInnerHTML`, and that is the
 * whole point. React 19 compares that prop by the identity of the `{ __html }` object, not by the
 * string inside it, so a component that builds the object inline rewrites the element's children on
 * every render — even when the markup has not changed by one character. Under Remotion that is every
 * frame: gsap writes the inline styles for the frame, React wipes them and puts the pristine markup
 * back, and the timeline goes on seeking nodes that are no longer in the document. What came out was
 * a film with a drifting background and no text on it at all.
 *
 * Returns the instance and a teardown. The caller re-runs it when the markup itself changes.
 */
export function mountSceneInto(root: HTMLElement, scene: PreparedScene, film: Pick<PreparedFilm, 'vars' | 'beats' | 'analysis'>): { instance: SceneInstance; dispose: () => void } {
  root.innerHTML = scene.html;
  const instance = new SceneInstance(root, scene, film);
  return {
    instance,
    dispose: () => {
      instance.dispose();
      root.innerHTML = '';
    },
  };
}
