import type { VideoIR } from '@/core/types/ir';
import type { BlockDef } from '@/core/types/payloads';
import { BIND_SCRIPT, baseStyles, esc, fillNamedSlot, findSlot, sceneMarkup, scopedCss, splitCode, tokenVars } from '@/core/look/markup';
import { CAPTION_STYLES, type CaptionStyle } from '@/core/types/payloads';

export { splitCode, fillSlot, tokenVars } from '@/core/look/markup';

/**
 * One self-contained HyperFrames composition per IR (CORE_CONTRACTS §2.8, §6.3).
 *
 * The page carries everything: gsap and the HyperFrames runtime inlined, the stage and block styles
 * scoped with `@scope`, one timed clip per scene with the stage markup wrapping the block markup,
 * the voice-over as a timed `<audio>`, and a bootstrap that binds props, runs each block's script
 * against a scene-scoped gsap, and registers the master timeline under `window.__timelines`. The
 * same string feeds the browser player (as `srcdoc`) and the producer (as `index.html`); only the
 * media and font paths differ.
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
 * Runs inside the composition before the runtime initialises. Binds props and fields into the
 * markup, runs the stage and block scripts of every scene with a gsap whose string targets are
 * resolved inside that scene only, and assembles the master timeline.
 */
export const BOOTSTRAP = String.raw`
(function () {
  var data = JSON.parse(document.getElementById('nodecine-data').textContent);
  var timelines = [];
  var unwrap = new WeakMap();
  var bindProps = window.__nodecineBind.props;
  var bindFields = window.__nodecineBind.fields;

  function scopedGsap(root) {
    var q = gsap.utils.selector(root);
    var fix = function (t) { return typeof t === 'string' ? q(t) : t; };
    var wrap = function (tl) {
      var proxy = new Proxy(tl, {
        get: function (target, key) {
          if (key === 'to' || key === 'from' || key === 'fromTo' || key === 'set') {
            return function (t) { var args = Array.prototype.slice.call(arguments, 1); target[key].apply(target, [fix(t)].concat(args)); return proxy; };
          }
          if (key === 'add') return function () { target.add.apply(target, arguments); return proxy; };
          var v = target[key];
          return typeof v === 'function' ? v.bind(target) : v;
        }
      });
      unwrap.set(proxy, tl);
      return proxy;
    };
    return {
      timeline: function (vars) { return wrap(gsap.timeline(vars)); },
      to: function (t, v) { return gsap.to(fix(t), v); },
      from: function (t, v) { return gsap.from(fix(t), v); },
      fromTo: function (t, a, b) { return gsap.fromTo(fix(t), a, b); },
      set: function (t, v) { return gsap.set(fix(t), v); },
      utils: gsap.utils,
      q: q
    };
  }

  data.scenes.forEach(function (scene) {
    var root = document.getElementById(scene.id);
    if (!root) return;
    bindFields(root, scene.fields || {});
    var block = root.querySelector('[data-block]');
    if (block) bindProps(block, scene.props || {});
    var g = scopedGsap(root);
    var collected = [];
    var nodecine = { timeline: function (tl) { collected.push(unwrap.get(tl) || tl); }, props: scene.props || {}, fields: scene.fields || {}, root: root };
    (scene.scripts || []).forEach(function (src) {
      try { new Function('gsap', 'nodecine', 'root', src)(g, nodecine, root); }
      catch (e) { console.error('[nodecine] scene ' + scene.id + ' script failed:', e); }
    });
    collected.forEach(function (tl) { timelines.push({ tl: tl, at: scene.start }); });
  });

  var master = gsap.timeline({ paused: true });
  timelines.forEach(function (entry) { entry.tl.paused(false); master.add(entry.tl, entry.at); });

  // Captions sit inside each scene's caption slot, so the stage's own CSS positions and styles
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
  master.set({}, {}, data.duration);
  window.__timelines = window.__timelines || {};
  window.__timelines[data.compositionId] = master;
})();
`;

/** `data-caption-style` on the stage's caption slot; karaoke unless it says reveal. */
export function captionStyleOf(slotTag: string): CaptionStyle {
  const m = /\bdata-caption-style=["']([a-z]+)["']/.exec(slotTag);
  const v = m?.[1] as CaptionStyle | undefined;
  return v && CAPTION_STYLES.includes(v) ? v : 'karaoke';
}

/**
 * What every caption needs regardless of stage (a line starts hidden, words sit inline), plus the
 * default band for a stage that declares no slot: inside the portrait safe zone, in the stage's body
 * font and foreground, the spoken word in the accent colour. A stage that has its own slot styles
 * it in its own CSS and may set `--caption-on` for the highlight.
 */
export function captionStyles(width: number, height: number, withDefaultSlot: boolean): string {
  const portrait = height > width;
  const size = Math.round((portrait ? width : height) * 0.042);
  return [
    // Hidden lines must not take up room: every line is anchored to the slot's bottom edge, so the
    // one that is showing sits where the stage put the slot, whatever came before it.
    `.nc-cap-line { position: absolute; left: 0; right: 0; bottom: 0; visibility: hidden; opacity: 0; text-wrap: balance; }`,
    `.nc-cap-w { display: inline-block; }`,
    ...(withDefaultSlot
      ? [`.nc-captions-default { position: absolute; left: ${portrait ? 72 : 96}px; right: ${portrait ? 168 : 96}px; bottom: ${portrait ? 720 : 96}px; text-align: center; font: 700 ${size}px/1.3 var(--font-body, sans-serif); color: color-mix(in srgb, var(--fg, #fff) 82%, transparent); text-shadow: 0 2px 12px rgba(0,0,0,.55); pointer-events: none; }`]
      : []),
  ].join('\n');
}

export function buildHyperframesDocument(ir: VideoIR, o: DocumentOptions): string {
  const { width, height, fps, totalDurationInFrames } = ir.meta;
  const scale = o.scale && o.scale > 0 ? o.scale : 1;
  // The file's pixels; everything inside stays in design coordinates and is zoomed by the root.
  const outW = Math.round(width * scale / 2) * 2;
  const outH = Math.round(height * scale / 2) * 2;
  const stage = ir.stage;
  const blocks = new Map(ir.blocks.map((b) => [b.id, b] as [string, BlockDef]));
  const stageCode = splitCode(stage.code.source);
  const blockCode = new Map([...blocks].map(([id, b]) => [id, splitCode(b.code.source)]));

  const duration = totalDurationInFrames / fps;
  // The stage decides where captions go and how they look (its `data-slot="captions"`); a stage
  // that declares no slot gets the default band inside the safe zone.
  const captionSlot = findSlot(stageCode.markup, 'captions');
  const stageMarkup = ir.captions && !captionSlot ? `${stageCode.markup}<div class="nc-captions-default" data-slot="captions"></div>` : stageCode.markup;
  const captionStyle = captionStyleOf(captionSlot?.tag ?? '');
  const scenes = ir.timeline.map((s, si) => {
    const bc = blockCode.get(s.blockId)!;
    const sceneStart = s.startFrame;
    const sceneEnd = s.startFrame + s.durationInFrames;
    // Every line spoken while this scene is on screen; a line across a cut is drawn in both scenes.
    const cues = (ir.captions?.cues ?? [])
      .map((c, ci) => ({ c, ci }))
      .filter(({ c }) => c.startFrame < sceneEnd && c.startFrame + c.durationInFrames > sceneStart)
      .map(({ c, ci }) => ({
        id: `nc-cap-${si}-${ci}`,
        show: c.startFrame / fps,
        hide: (c.startFrame + c.durationInFrames) / fps,
        style: captionStyle,
        words: c.words.map((w, wi) => ({ id: `nc-cap-${si}-${ci}-w${wi}`, text: w.text, at: w.startFrame / fps })),
      }));
    const cuesHtml = cues.map((cue) => `<div id="${cue.id}" class="nc-cap-line">${cue.words.map((w) => `<span id="${w.id}" class="nc-cap-w"${captionStyle === 'reveal' ? ' style="opacity:0"' : ''}>${esc(w.text)}</span>`).join(' ')}</div>`).join('');
    const markup = fillNamedSlot(sceneMarkup(stageMarkup, bc.markup, s.blockId), 'captions', cuesHtml);
    return {
      id: s.id,
      start: s.startFrame / fps,
      duration: s.durationInFrames / fps,
      html: `<div id="${esc(s.id)}" class="clip nc-scene" data-start="${s.startFrame / fps}" data-duration="${s.durationInFrames / fps}" data-track-index="0" data-stage${s.tone ? ` data-tone="${esc(s.tone)}"` : ''} style="${esc(tokenVars(stage, s.tone))}">${markup}</div>`,
      data: { id: s.id, start: s.startFrame / fps, props: s.props, fields: s.fields ?? {}, scripts: [...stageCode.scripts, ...bc.scripts], captions: cues.map((cue) => ({ id: cue.id, show: cue.show, hide: cue.hide, style: cue.style, words: cue.words.map((w) => ({ id: w.id, at: w.at })) })) },
    };
  });

  const styles = [
    baseStyles(stage, width, height, o.fontBase),
    `.clip { position: absolute; inset: 0; visibility: hidden; overflow: hidden; }`,
    // The runtime sizes the composition root from data-width/height (the file's pixels), so the
    // scenes live in an inner frame that keeps the design size and is scaled as one picture. A
    // transform, not `zoom`: zoom left bottom-anchored offsets unscaled.
    ...(scale !== 1 ? [`html, body, [data-composition-id] { width: ${outW}px; height: ${outH}px; }`, `.nc-frame { position: absolute; left: 0; top: 0; width: ${width}px; height: ${height}px; transform: scale(${scale}); transform-origin: 0 0; overflow: hidden; }`] : []),
    ...(ir.captions ? [captionStyles(width, height, !captionSlot)] : []),
    scopedCss('[data-stage]', stageCode.styles.join('\n')),
    ...[...blockCode].map(([id, bc]) => scopedCss(`[data-block="${id}"]`, bc.styles.join('\n'))),
  ].filter(Boolean);

  const data = { compositionId: COMPOSITION_ID, duration, scenes: scenes.map((s) => s.data) };

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
