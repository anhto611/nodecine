import type { VideoIR } from '@/core/types/ir';
import { BIND_SCRIPT, SCENE_HELPERS, SCOPED_GSAP, baseLayer, baseStyles, captionLine, captionStyleOf, captionStyles, esc, sceneMarkup, scopedCss, styleCss } from './markup';

export { splitCode, captionStyleOf, captionStyles } from './markup';

/**
 * One self-contained HyperFrames composition per IR (CORE_CONTRACTS §2.8, §6.3).
 *
 * The page carries everything: gsap and the HyperFrames runtime inlined, the film's style sheet and
 * each scene's own styles scoped with `@scope`, one timed clip per scene holding the scene's markup,
 * the voice-over as a timed `<audio>`, and a bootstrap that binds the video's values, runs each
 * scene's script against a scene-scoped gsap, and registers the master timeline under
 * `window.__timelines`. The same string feeds the browser player (as `srcdoc`) and the producer (as
 * `index.html`); only the media and font paths differ.
 *
 * Isomorphic and pure: strings in, string out, no DOM. Testable without a browser.
 */

export interface DocumentOptions {
  /** gsap.min.js source, inlined. */
  gsapSource: string;
  /** @hyperframes/core runtime IIFE source, inlined. */
  runtimeSource: string;
  /** Where the voice-over is: an app-relative URL in the browser, a file next to index.html for a render. */
  voiceoverSrc: string;
  /** Directory the JetBrains Mono faces are served from, without trailing slash. */
  fontBase: string;
  /** Render scale: the page is laid out in design pixels and zoomed, so 2 turns 1080×1920 into 2160×3840. */
  scale?: number;
  /** Where `/api/assets/<name>` files are for this document: a folder next to index.html for a render; unset in the browser. */
  assetBase?: string;
}

/** Marker the HyperFrames player looks for before deciding to inject a runtime of its own. */
export const RUNTIME_MARKER = '<!-- hyperframe.runtime.iife.js (inlined) -->';
export const COMPOSITION_ID = 'nodecine';

/**
 * Runs inside the composition before the runtime initialises. Binds the video's values and each
 * scene's facts into the markup, runs every scene's script with a gsap whose string targets are
 * resolved inside that scene only, and assembles the master timeline.
 */
export const BOOTSTRAP = String.raw`
(function () {
  var data = JSON.parse(document.getElementById('nodecine-data').textContent);
  var timelines = [];
  var unwrap = new WeakMap();
  __SCOPED_GSAP__

  data.scenes.forEach(function (scene) {
    var root = document.getElementById(scene.id);
    if (!root) return;
    window.__nodecineBind.vars(root, data.vars || {});
    window.__nodecineBind.facts(root, scene.facts || {});
    var g = scopedGsap(root, unwrap);
    var collected = [];
    var nodecine = { timeline: function (tl) { collected.push(unwrap.get(tl) || tl); }, root: root, index: scene.index || 0, duration: scene.duration || 0, words: scene.words || [] };
    __SCENE_HELPERS__
    (scene.scripts || []).forEach(function (src) {
      try { new Function('gsap', 'nodecine', 'root', src)(g, nodecine, root); }
      catch (e) { console.error('[nodecine] scene ' + scene.id + ' script failed:', e); }
    });
    collected.forEach(function (tl) { timelines.push({ tl: tl, at: scene.start }); });
  });

  var master = gsap.timeline({ paused: true });
  timelines.forEach(function (entry) { entry.tl.paused(false); master.add(entry.tl, entry.at); });

  // Captions sit inside each scene's caption slot, so the scene's own CSS positions and styles
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
  // Transitions (CORE_CONTRACTS §2.6): the incoming scene starts at the cut and is drawn over the
  // outgoing one, which the runtime keeps mounted for the length of the transition. Opacity and
  // transform on the clip itself; the runtime only owns visibility.
  var tr = data.transition || { type: 'cut', seconds: 0 };
  if (tr.type !== 'cut' && tr.seconds > 0) {
    data.scenes.forEach(function (scene, i) {
      if (i === 0) return;
      var el = document.getElementById(scene.id);
      var prev = document.getElementById(data.scenes[i - 1].id);
      if (!el) return;
      var t = scene.start, d = tr.seconds;
      if (tr.type === 'fade') {
        master.fromTo(el, { opacity: 0 }, { opacity: 1, duration: d, ease: 'power1.inOut' }, t);
      } else if (tr.type === 'slide') {
        master.fromTo(el, { yPercent: 100 }, { yPercent: 0, duration: d, ease: 'power3.out' }, t);
        if (prev) master.fromTo(prev, { yPercent: 0, opacity: 1 }, { yPercent: -18, opacity: 0.4, duration: d, ease: 'power3.out' }, t);
      } else if (tr.type === 'zoom') {
        master.fromTo(el, { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: d, ease: 'power2.out' }, t);
        if (prev) master.fromTo(prev, { scale: 1 }, { scale: 0.96, duration: d, ease: 'power2.out' }, t);
      }
    });
  }
  master.set({}, {}, data.duration);
  window.__timelines = window.__timelines || {};
  window.__timelines[data.compositionId] = master;
})();
`.replace('__SCOPED_GSAP__', SCOPED_GSAP).replace('__SCENE_HELPERS__', SCENE_HELPERS);

export function buildHyperframesDocument(ir: VideoIR, o: DocumentOptions): string {
  const { width, height, fps, totalDurationInFrames } = ir.meta;
  const scale = o.scale && o.scale > 0 ? o.scale : 1;
  // The file's pixels; everything inside stays in design coordinates and is zoomed by the root.
  const outW = Math.round(width * scale / 2) * 2;
  const outH = Math.round(height * scale / 2) * 2;

  const duration = totalDurationInFrames / fps;
  const transition = ir.transition;
  const overlap = transition.type === 'cut' ? 0 : transition.seconds;
  const allCues = ir.captions?.cues ?? [];
  const scenes = ir.timeline.map((s, si) => {
    const sceneStart = s.startFrame;
    const sceneEnd = s.startFrame + s.durationInFrames;
    // Every scene but the last stays up through the next one's transition; the incoming scene is drawn on top.
    const clipSeconds = si < ir.timeline.length - 1 ? Math.min(duration - sceneStart / fps, s.durationInFrames / fps + overlap) : s.durationInFrames / fps;
    // Each scene decides where its captions go (its `data-slot="captions"`); one without a slot gets the default band.
    const bare = sceneMarkup(s.source, { withCaptions: !!ir.captions, start: sceneStart / fps, duration: s.durationInFrames / fps });
    const captionStyle = captionStyleOf(bare.captionSlot?.tag ?? '');
    // Every line spoken while this scene is on screen; a line across a cut is drawn in both scenes.
    const cues = allCues
      .map((c, ci) => ({ c, ci }))
      .filter(({ c }) => c.startFrame < sceneEnd && c.startFrame + c.durationInFrames > sceneStart)
      .map(({ c, ci }) => ({
        id: `nc-cap-${si}-${ci}`,
        show: c.startFrame / fps,
        hide: (c.startFrame + c.durationInFrames) / fps,
        style: captionStyle,
        words: c.words.map((w, wi) => ({ id: `nc-cap-${si}-${ci}-w${wi}`, text: w.text, at: w.startFrame / fps })),
      }));
    // The words the voice says while this scene is up, on the scene's own clock, for `nodecine.when`.
    const words = allCues.flatMap((c) => c.words).filter((w) => w.startFrame >= sceneStart && w.startFrame < sceneEnd).map((w) => ({ text: w.text, start: (w.startFrame - sceneStart) / fps }));
    const cuesHtml = cues.map((cue) => captionLine(cue.id, cue.words, captionStyle)).join('');
    const scene = sceneMarkup(s.source, { captionsHtml: cuesHtml, withCaptions: !!ir.captions, start: sceneStart / fps, duration: s.durationInFrames / fps });
    return {
      id: s.id,
      html: `<div id="${esc(s.id)}" class="clip nc-scene" data-scene="${esc(s.id)}" data-start="${s.startFrame / fps}" data-duration="${clipSeconds}" data-track-index="0">${scene.html}</div>`,
      css: scopedCss(`[data-scene="${esc(s.id)}"]`, scene.styles.join('\n')),
      defaultBand: !scene.captionSlot,
      data: { id: s.id, index: si, start: s.startFrame / fps, duration: s.durationInFrames / fps, facts: s.facts ?? {}, words, scripts: scene.scripts, captions: cues },
    };
  });

  const styles = [
    baseStyles(width, height, o.fontBase),
    baseLayer(`.clip { position: absolute; inset: 0; visibility: hidden; overflow: hidden; }`),
    // The runtime sizes the composition root from data-width/height (the file's pixels), so the
    // scenes live in an inner frame that keeps the design size and is scaled as one picture. A
    // transform, not `zoom`: zoom left bottom-anchored offsets unscaled.
    ...(scale !== 1 ? [`html, body, [data-composition-id] { width: ${outW}px; height: ${outH}px; }`, `.nc-frame { position: absolute; left: 0; top: 0; width: ${width}px; height: ${height}px; transform: scale(${scale}); transform-origin: 0 0; }`] : []),
    ...(ir.captions ? [baseLayer(captionStyles(width, height, scenes.some((s) => s.defaultBand)))] : []),
    styleCss(ir.style),
    ...scenes.map((s) => s.css),
  ].filter(Boolean);

  // One map for the whole video, bound into every scene: the date and the like do not change per scene.
  const data = { compositionId: COMPOSITION_ID, duration, transition, vars: ir.vars ?? {}, scenes: scenes.map((s) => s.data) };

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
    ...(scale !== 1 ? [`<div class="nc-frame">`, ...scenes.map((s) => s.html), `</div>`] : scenes.map((s) => s.html)),
    `<audio id="voiceover" data-start="0" data-duration="${ir.audioTrack.durationSeconds}" data-track-index="1" src="${esc(o.voiceoverSrc)}"></audio>`,
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
