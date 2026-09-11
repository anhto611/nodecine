import { speechWindowsOf, beatClipsOf, type Clip, type CodeClip, type VideoIR } from '@/core/types/ir';
import { transitionCatalogScript } from './transitions';
import { BIND_SCRIPT, SCENE_MOUNT, baseLayer, baseStyles, captionLine, captionStyleOf, captionStyles, esc, sceneMarkup, scopedCss, styleCss } from './markup';

export { splitCode, captionStyleOf, captionStyles } from './markup';

/**
 * One self-contained HyperFrames composition per IR (CORE_CONTRACTS §2.8, §6.3; docs/IR_V3.md).
 *
 * The page carries everything: gsap and the HyperFrames runtime inlined, the film's style sheet and
 * each code clip's own styles scoped with `@scope`, one timed clip per IR clip on its track, one timed
 * `<audio>` per audio track, and a bootstrap that binds the video's values, runs each code clip's
 * script against a clip-scoped gsap, and registers the master timeline under `window.__timelines`.
 * The same string feeds the browser player (as `srcdoc`) and the producer (as `index.html`); only
 * the media and font paths differ.
 *
 * Tracks map straight onto HyperFrames' own `data-track-index`; a clip that spans the film is just a
 * clip that spans the film. The beats decide where captions go and which words a clip hears.
 *
 * Isomorphic and pure: strings in, string out, no DOM. Testable without a browser.
 */

export interface DocumentOptions {
  /** gsap.min.js source, inlined. */
  gsapSource: string;
  /** @hyperframes/core runtime IIFE source, inlined. */
  runtimeSource: string;
  /**
   * Where a `/api/media/…` file is for this page: the app URL itself in the browser, a file next to
   * index.html for a render. Identity when absent.
   */
  mediaSrc?: (url: string) => string;
  /** Directory the JetBrains Mono faces are served from, without trailing slash. */
  fontBase: string;
  /** Render scale: the page is laid out in design pixels and zoomed, so 2 turns 1080×1920 into 2160×3840. */
  scale?: number;
  /** Where `/api/assets/<name>` files are for this document: a folder next to index.html for a render; unset in the browser. */
  assetBase?: string;
  /** The analysis JSON of each track that has one, by track id, read by the caller: the page may not fetch. */
  analysis?: Record<string, unknown>;
}

/** Marker the HyperFrames player looks for before deciding to inject a runtime of its own. */
export const RUNTIME_MARKER = '<!-- hyperframe.runtime.iife.js (inlined) -->';
export const COMPOSITION_ID = 'nodecine';

/**
 * Runs inside the composition before the runtime initialises. Binds the video's values and each
 * clip's facts into the markup, runs every code clip's script with a gsap whose string targets are
 * resolved inside that clip only, and assembles the master timeline.
 */
export const BOOTSTRAP = String.raw`
(function () {
  var data = JSON.parse(document.getElementById('nodecine-data').textContent);
  var timelines = [];
  var unwrap = new WeakMap();
  __SCENE_MOUNT__

  data.scenes.forEach(function (scene) {
    var root = document.getElementById(scene.id);
    if (!root) return;
    mountScene(gsap, root, scene, data, unwrap).forEach(function (tl) { timelines.push({ tl: tl, at: scene.start }); });
  });

  var master = gsap.timeline({ paused: true });
  timelines.forEach(function (entry) { entry.tl.paused(false); master.add(entry.tl, entry.at); });

  // Fades are volume keyframes on the master timeline: the runtime reads them there and applies
  // the same curve in the preview and in the render, which a static attribute cannot promise.
  (data.audio || []).forEach(function (a) {
    var el = document.getElementById(a.id);
    if (!el) return;
    var fadeIn = Math.min(a.fadeIn, a.duration / 2);
    var fadeOut = Math.min(a.fadeOut, a.duration - fadeIn);
    if (fadeIn > 0) master.fromTo(el, { volume: 0 }, { volume: a.gain, duration: fadeIn, ease: 'none' }, a.start);
    if (fadeOut > 0) master.to(el, { volume: 0, duration: fadeOut, ease: 'none' }, a.start + a.duration - fadeOut);
    // Under the voice the track dips to its duck level: down a little before the first word, back up after the last.
    if (a.duck) (a.duck.windows || []).forEach(function (w) {
      var from = Math.max(a.start, w[0] - 0.15), to = Math.min(a.start + a.duration, w[1]);
      if (to <= from) return;
      master.to(el, { volume: a.duck.to, duration: 0.25, ease: 'none' }, from);
      master.to(el, { volume: a.gain, duration: 0.4, ease: 'none' }, to);
    });
  });

  // Captions sit inside each beat clip's caption slot, so the clip's own CSS positions and styles
  // them. Lines and words are switched on the master timeline at absolute times; the CSS holds the
  // initial state (line hidden, reveal words transparent), so a seek reads the same frame as a play.
  data.scenes.forEach(function (scene) {
    (scene.captions || []).forEach(function (cue) {
      var line = document.getElementById(cue.id);
      if (!line) return;
      master.set(line, { autoAlpha: 1 }, cue.show);
      master.set(line, { autoAlpha: 0 }, cue.hide);
      cue.words.forEach(function (w) {
        var el = document.getElementById(w.id);
        if (!el) return;
        if (cue.style === 'reveal') master.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, w.at);
        else master.set(el, { color: 'var(--caption-on, var(--accent))' }, w.at);
      });
    });
  });
  // Transitions (CORE_CONTRACTS §2.6) happen between beats: the incoming beat clip starts at the cut
  // and is drawn over the outgoing one, which the runtime keeps mounted for the length of the
  // transition. Opacity, transform and clip-path on the clip itself; the runtime only owns visibility.
  // The catalogue is this engine's registry, inlined; a name not in it is a cut here and a block at
  // the output node, which asks the registry before the film gets this far.
  var catalog = __TRANSITION_CATALOG__;
  var byBeat = {};
  (data.transitions.at || []).forEach(function (o) { byBeat[o.afterClipId] = o; });
  data.beats.forEach(function (beat, i) {
    if (i === 0) return;
    var prevBeat = data.beats[i - 1];
    var tr = byBeat[prevBeat.clipId] || data.transitions.default || { name: 'cut', seconds: 0 };
    if (tr.name === 'cut' || !(tr.seconds > 0)) return;
    var el = document.getElementById(beat.clipId);
    var prev = document.getElementById(prevBeat.clipId);
    if (!el) return;
    var draw = catalog[tr.name];
    if (draw) draw(master, el, prev, beat.start, tr.seconds);
  });
  master.set({}, {}, data.duration);
  window.__timelines = window.__timelines || {};
  window.__timelines[data.compositionId] = master;
})();
`.replace('__SCENE_MOUNT__', SCENE_MOUNT).replace('__TRANSITION_CATALOG__', transitionCatalogScript());

const IMAGE_URL = /\.(png|jpe?g|webp|gif|svg)$/i;

export function buildHyperframesDocument(ir: VideoIR, o: DocumentOptions): string {
  const { width, height, fps, totalDurationInFrames } = ir.meta;
  const scale = o.scale && o.scale > 0 ? o.scale : 1;
  const mediaSrc = o.mediaSrc ?? ((url: string) => url);
  // The file's pixels; everything inside stays in design coordinates and is zoomed by the root.
  const outW = Math.round(width * scale / 2) * 2;
  const outH = Math.round(height * scale / 2) * 2;

  const duration = totalDurationInFrames / fps;
  const defaultTransition = ir.transitions.default;
  const overlapAfter = new Map<string, number>();
  {
    // Every beat clip but the last stays up through the next beat's transition; the incoming clip is drawn on top.
    const overrides = new Map((ir.transitions.at ?? []).map((t) => [t.afterClipId, t] as const));
    ir.beats.forEach((b, i) => {
      if (i === ir.beats.length - 1) return;
      const tr = overrides.get(b.clipId) ?? defaultTransition;
      overlapAfter.set(b.clipId, tr.name === 'cut' ? 0 : tr.seconds);
    });
  }
  const beatByClip = new Map(ir.beats.map((b) => [b.clipId, b] as const));
  const beatClips = beatClipsOf(ir);
  const allCues = ir.captions?.cues ?? [];

  const codeClip = (c: CodeClip, trackIndex: number) => {
    const beat = beatByClip.get(c.id);
    const start = c.startFrame;
    const end = c.startFrame + c.durationInFrames;
    // The window the clip listens to: its beat's when it draws one, its own when it spans the film.
    const hearFrom = beat ? beat.startFrame : start;
    const hearTo = beat ? beat.startFrame + beat.durationInFrames : end;
    const si = beat ? beat.index : beatClips.length + ir.tracks.slice(0, trackIndex).reduce((n, t) => n + t.clips.length, 0);
    // A fade keeps the clip up into the next beat, never past the film. Without one the clip's own
    // length is divided once, so the last scene of a film is frames/fps and not a sum of rounded seconds.
    const overlap = overlapAfter.get(c.id) ?? 0;
    const clipSeconds = overlap ? Math.min(duration - start / fps, c.durationInFrames / fps + overlap) : c.durationInFrames / fps;
    // Each clip decides where its captions go (its `data-slot="captions"`); a beat clip without a slot gets the default band.
    const bare = sceneMarkup(c.source, { withCaptions: !!ir.captions && !!beat, start: start / fps, duration: c.durationInFrames / fps });
    const captionStyle = captionStyleOf(bare.captionSlot?.tag ?? '');
    // Every line spoken while this beat is on screen; a line across a cut is drawn in both beats.
    const cues = beat
      ? allCues
          .map((cue, ci) => ({ cue, ci }))
          .filter(({ cue }) => cue.startFrame < hearTo && cue.startFrame + cue.durationInFrames > hearFrom)
          .map(({ cue, ci }) => ({
            id: `nc-cap-${si}-${ci}`,
            show: cue.startFrame / fps,
            hide: (cue.startFrame + cue.durationInFrames) / fps,
            style: captionStyle,
            words: cue.words.map((w, wi) => ({ id: `nc-cap-${si}-${ci}-w${wi}`, text: w.text, at: w.startFrame / fps })),
          }))
      : [];
    // The words the voice says while this clip is up, on the clip's own clock, for `nodecine.when`.
    const words = allCues.flatMap((cue) => cue.words).filter((w) => w.startFrame >= hearFrom && w.startFrame < hearTo).map((w) => ({ text: w.text, start: (w.startFrame - start) / fps }));
    const cuesHtml = cues.map((cue) => captionLine(cue.id, cue.words, captionStyle)).join('');
    const scene = sceneMarkup(c.source, { captionsHtml: cuesHtml, withCaptions: !!ir.captions && !!beat, start: start / fps, duration: c.durationInFrames / fps });
    return {
      html: `<div id="${esc(c.id)}" class="clip nc-scene" data-scene="${esc(c.id)}" data-start="${start / fps}" data-duration="${clipSeconds}" data-track-index="${trackIndex}">${scene.html}</div>`,
      css: scopedCss(`[data-scene="${esc(c.id)}"]`, scene.styles.join('\n')),
      defaultBand: !!beat && !scene.captionSlot,
      data: { id: c.id, index: si, track: trackIndex, start: start / fps, duration: c.durationInFrames / fps, facts: c.facts ?? {}, words, scripts: scene.scripts, captions: cues },
    };
  };

  // A file on a track: framed by the framework, timed by the clip. The runtime reads the element's
  // own `loop`, `data-media-start` for the offset into the file, and `data-volume` for its sound.
  const mediaClip = (c: Extract<Clip, { kind: 'media' }>, trackIndex: number) => {
    const src = esc(mediaSrc(c.url));
    const timing = `data-start="${c.startFrame / fps}" data-duration="${c.durationInFrames / fps}" data-track-index="${trackIndex}"`;
    const style = `style="object-fit: ${c.fit}"`;
    const media = [c.offsetSeconds > 0 ? `data-media-start="${c.offsetSeconds}"` : '', c.gain > 0 ? `data-volume="${c.gain}"` : 'muted', c.loop ? 'loop' : '', 'playsinline'].filter(Boolean).join(' ');
    const html = IMAGE_URL.test(c.url)
      ? `<img id="${esc(c.id)}" class="clip nc-media" ${timing} src="${src}" ${style}>`
      : `<video id="${esc(c.id)}" class="clip nc-media" ${timing} src="${src}" ${style} ${media}></video>`;
    return { html, css: '', defaultBand: false, data: null };
  };

  const rendered = ir.tracks.flatMap((track, ti) => track.clips.map((c) => (c.kind === 'code' ? codeClip(c, ti) : mediaClip(c, ti))));
  const scenes = rendered.flatMap((r) => (r.data ? [r] : []));
  const hasMedia = rendered.length !== scenes.length;

  const styles = [
    baseStyles(width, height, o.fontBase),
    baseLayer(`.clip { position: absolute; inset: 0; visibility: hidden; overflow: hidden; }`),
    ...(hasMedia ? [baseLayer(`.nc-media { width: 100%; height: 100%; display: block; }`)] : []),
    // The runtime sizes the composition root from data-width/height (the file's pixels), so the
    // clips live in an inner frame that keeps the design size and is scaled as one picture. A
    // transform, not `zoom`: zoom left bottom-anchored offsets unscaled.
    ...(scale !== 1 ? [`html, body, [data-composition-id] { width: ${outW}px; height: ${outH}px; }`, `.nc-frame { position: absolute; left: 0; top: 0; width: ${width}px; height: ${height}px; transform: scale(${scale}); transform-origin: 0 0; }`] : []),
    ...(ir.captions ? [baseLayer(captionStyles(width, height, scenes.some((s) => s.defaultBand)))] : []),
    styleCss(ir.style),
    ...rendered.map((r) => r.css),
  ].filter(Boolean);

  // One map for the whole video, bound into every clip: the date and the like do not change per clip.
  const data = {
    compositionId: COMPOSITION_ID,
    duration,
    transitions: ir.transitions,
    vars: ir.vars ?? {},
    beats: ir.beats.map((b) => ({ ...b, start: b.startFrame / fps, duration: b.durationInFrames / fps })),
    scenes: scenes.map((s) => s.data),
    analysis: o.analysis ?? {},
    // What the bootstrap draws on each track's volume: a ramp in, a ramp out, and the dips under the
    // voice for a track that ducks. Nothing for a track with none of the three.
    audio: ir.audio.filter((a) => a.fadeInSeconds || a.fadeOutSeconds || a.duck).map((a) => ({
      id: a.id,
      start: a.startFrame / fps,
      duration: a.durationInFrames / fps,
      gain: a.gain,
      fadeIn: a.fadeInSeconds ?? 0,
      fadeOut: a.fadeOutSeconds ?? 0,
      ...(a.duck ? { duck: { to: a.duck.to, windows: speechWindowsOf(ir).map((w) => [w.startFrame / fps, w.endFrame / fps]) } } : {}),
    })),
  };

  // Audio tracks sit on their own HyperFrames tracks above every visual one. The runtime reads the
  // element's `loop`, `data-media-start` for the offset into the file, and `data-volume` for its level.
  const audio = ir.audio.map((a, ai) => {
    const extra = [a.gain !== 1 ? ` data-volume="${a.gain}"` : '', a.offsetSeconds ? ` data-media-start="${a.offsetSeconds}"` : '', a.loop ? ' loop' : ''].join('');
    return `<audio id="${esc(a.id)}" data-start="${a.startFrame / fps}" data-duration="${a.durationInFrames / fps}" data-track-index="${ir.tracks.length + ai}"${extra} src="${esc(mediaSrc(a.url))}"></audio>`;
  });

  // The page may load media and fonts, run its own inline scripts, and nothing else: no fetch, no
  // external scripts, no images from the network. The runtime is inlined for the same reason.
  const csp = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src http: https: data: blob:; media-src http: https: blob: data:; font-src http: https: data:; connect-src 'none'";

  // Script order matters: gsap, then the HyperFrames runtime, then the page. The runtime owns
  // `window.__timelines` (it installs a registry there), so a timeline registered before it loads
  // is lost, the producer waits its full readiness timeout, and nothing animates.
  const page = [
    `<!doctype html>`,
    `<html lang="${esc(ir.meta.language)}" data-resolution="${height > width ? 'portrait' : 'landscape'}">`,
    `<head>`,
    `<meta charset="utf-8">`,
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    `<meta name="viewport" content="width=${outW}, height=${outH}">`,
    `<title>${esc(ir.meta.title)}</title>`,
    `<script>${o.gsapSource}</script>`,
    RUNTIME_MARKER,
    `<script data-hyperframes-preview-runtime>${o.runtimeSource}</script>`,
    `<style>\n${styles.join('\n')}\n</style>`,
    `</head>`,
    `<body>`,
    `<div id="${COMPOSITION_ID}" data-composition-id="${COMPOSITION_ID}" data-start="0" data-duration="${duration}" data-width="${outW}" data-height="${outH}" data-fps="${fps}">`,
    ...(scale !== 1 ? [`<div class="nc-frame">`, ...rendered.map((r) => r.html), `</div>`] : rendered.map((r) => r.html)),
    ...audio,
    `</div>`,
    `<script type="application/json" id="nodecine-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`,
    `<script>${BIND_SCRIPT}</script>`,
    `<script>${BOOTSTRAP}</script>`,
    `</body>`,
    `</html>`,
  ].join('\n');
  // For a render the assets sit beside index.html; the names are hashed, so a plain replace is exact.
  return o.assetBase ? page.replace(/\/api\/assets\/([a-f0-9]{16,64}\.[a-z0-9]+)/g, `${o.assetBase}/$1`) : page;
}
