import { CAPTION_STYLES, type CaptionStyle, type Style } from '@/core/types/payloads';
import type { ScenePreviewOptions } from '@/core/adapters/types';
import { CAPTION_SLOT, DEFAULT_CAPTION_BAND_CLASS, EMPH_CLASS, FACT_ATTR, SCENE_ROOT_CLASS, VAR_ATTR } from '@/core/visual/contract';

/**
 * The markup side of a scene (CORE_CONTRACTS §2.8), shared by every engine and by the Studio's
 * previews: how a scene's source splits into markup, style and script; where captions go; the
 * fonts every page bundles; and the script that binds the video's values into the markup inside
 * the page. Pure strings; no DOM, no engine.
 */

/** Split a scene's source into markup, style text and script text. */
export function splitCode(source: string): { markup: string; styles: string[]; scripts: string[] } {
  const styles: string[] = [];
  const scripts: string[] = [];
  const markup = source
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css: string) => { styles.push(css.trim()); return ''; })
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, js: string) => { scripts.push(js.trim()); return ''; })
    .trim();
  return { markup, styles, scripts };
}

/** The opening tag of `data-slot="<name>"` in the markup, or null. */
export function findSlot(markup: string, name: string): { index: number; tag: string } | null {
  const m = new RegExp(`<([a-zA-Z][\\w-]*)\\b[^>]*\\bdata-slot=["']${name}["'][^>]*>`).exec(markup);
  return m ? { index: m.index, tag: m[0] } : null;
}

/** Drops `inner` into the named slot; markup without that slot gets it appended at the end. */
export function fillNamedSlot(markup: string, name: string, inner: string): string {
  const slot = findSlot(markup, name);
  if (!slot) return `${markup}${inner}`;
  const at = slot.index + slot.tag.length;
  return `${markup.slice(0, at)}${inner}${markup.slice(at)}`;
}

export const scopedCss = (selector: string, css: string): string => (css ? `@scope (${selector}) {\n${css}\n}` : '');

export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The typefaces every page bundles (ARCHITECTURE §6). Files, not links: a render must not depend on
 * Google Fonts answering, and `font-display: block` keeps a frame from being captured mid-swap with
 * the fallback still on screen.
 *
 * Comfortaa is one variable file per subset, 300 to 700 — asking for 800 makes the browser fake the
 * weight by smearing, which shows as a furred edge over a photograph. It is split by unicode range
 * the way Google serves it, so a Vietnamese caption pulls 7 KB and an English one never loads it.
 */
export const FONT_FILES = [
  'JetBrainsMono-Regular.woff2',
  'JetBrainsMono-Bold.woff2',
  'JetBrainsMono-ExtraBold.woff2',
  'Comfortaa-latin.woff2',
  'Comfortaa-latin-ext.woff2',
  'Comfortaa-vietnamese.woff2',
] as const;

const VIETNAMESE = 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB';
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';
const LATIN = 'U+0000-005F, U+0061-007F, U+00A0-00A9, U+00AB-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

export const fontFaces = (base: string): string =>
  [
    ...[
      ['400', 'JetBrainsMono-Regular.woff2'],
      ['700', 'JetBrainsMono-Bold.woff2'],
      ['800', 'JetBrainsMono-ExtraBold.woff2'],
    ].map(([w, f]) => `@font-face { font-family: 'JetBrains Mono'; font-weight: ${w}; font-style: normal; font-display: block; src: url('${base}/${f}') format('woff2'); }`),
    ...[
      ['Comfortaa-vietnamese.woff2', VIETNAMESE],
      ['Comfortaa-latin-ext.woff2', LATIN_EXT],
      ['Comfortaa-latin.woff2', LATIN],
    ].map(([f, range]) => `@font-face { font-family: 'Comfortaa'; font-weight: 300 700; font-style: normal; font-display: block; src: url('${base}/${f}') format('woff2'); unicode-range: ${range}; }`),
  ].join('\n');

/**
 * The cascade every page shares (CORE_CONTRACTS §2.8): the engine's defaults in the lowest layer,
 * the film's style sheet above them, and each scene's own styles unlayered on top. Layers, not
 * specificity: a scene's `.card { top: 480px }` beats the sheet's `.nc-scene .card` whatever
 * either was written as, and the sheet's `.nc-captions-default` beats the engine's.
 */
export const LAYERS = `@layer nc-base, nc-style;`;
export const baseLayer = (css: string): string => `@layer nc-base {\n${css}\n}`;

/** The base styles every page that draws scenes shares: the fonts, a reset, the frame. */
export function baseStyles(width: number, height: number, fontBase: string): string {
  return [
    LAYERS,
    fontFaces(fontBase),
    baseLayer([
      `* { margin: 0; padding: 0; box-sizing: border-box; }`,
      `html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: #000; }`,
      `[data-composition-id] { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; background: #000; }`,
      `.${SCENE_ROOT_CLASS} { position: absolute; inset: 0; overflow: hidden; }`,
      `.${EMPH_CLASS} { font-style: inherit; color: var(--accent); }`,
    ].join('\n')),
  ].join('\n');
}

/** The film's own style sheet, in its layer, scoped to the frame so a `.nc-scene` rule in it reaches every scene. */
export const styleCss = (style: Style): string => (style.css.trim() ? `@layer nc-style {\n${scopedCss('[data-composition-id]', style.css)}\n}` : '');

/**
 * Give every `<video>` in a scene the scene's own place on the timeline (CORE_CONTRACTS §2.9).
 *
 * The producer reads `data-start` and `data-duration` straight off the video element to know which
 * seconds of the clip to pull frames for; a video without them is taken to start at zero and run for
 * its natural length, which would put a B-roll shot at the top of the film instead of in its scene.
 * A scene that stamps its own timing is left alone — an author who wrote it meant it.
 *
 * `muted` goes on as well: the film's sound is the voice-over, and a clip's own audio would talk over it.
 */
export function timeVideos(html: string, start: number, duration: number): string {
  return html.replace(/<(video)\b([^>]*)>/gi, (_tag, name: string, attrs: string) => {
    const add = [
      /\bdata-start\s*=/i.test(attrs) ? '' : ` data-start="${start}"`,
      /\bdata-duration\s*=|\bdata-end\s*=/i.test(attrs) ? '' : ` data-duration="${duration}"`,
      /\bmuted\b/i.test(attrs) ? '' : ' muted',
      /\bplaysinline\b/i.test(attrs) ? '' : ' playsinline',
    ].join('');
    return `<${name}${attrs}${add}>`;
  });
}

/**
 * Binds the video's values into a scene root, in the page: `data-var` takes a value of the whole
 * video and `data-fact` a verified value of this scene — as text, or as the source of an image or
 * video element — or the element goes when there is no value. Defined once as functions on
 * `window.__nodecineBind`.
 */
export const BIND_SCRIPT = String.raw`
window.__nodecineBind = {
  fill: function (root, attr, values) {
    root.querySelectorAll('[' + attr + ']').forEach(function (el) {
      var v = values[el.getAttribute(attr)];
      if (v === undefined || v === null || v === '') { el.remove(); return; }
      if (el.tagName === 'IMG' || el.tagName === 'VIDEO') { el.setAttribute('src', String(v)); return; }
      if (typeof v === 'number') { el.textContent = v.toLocaleString('en-US'); return; }
      el.textContent = Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
    });
  },
  vars: function (root, vars) { window.__nodecineBind.fill(root, '__VAR_ATTR__', vars || {}); },
  facts: function (root, facts) { window.__nodecineBind.fill(root, '__FACT_ATTR__', facts || {}); }
};
`.replace('__VAR_ATTR__', VAR_ATTR).replace('__FACT_ATTR__', FACT_ATTR);

/**
 * The helpers a scene's script gets on `nodecine` besides `timeline`, `root`, `index` and
 * `duration`: `count` makes a number count up to what its element shows, and `when(phrase)` is
 * the second, from the start of the scene, the voice reaches a phrase — so a point can appear
 * as it is said. Without word timings the phrases are spread over the scene in the order asked.
 * Shared by the render document and the preview so a scene runs the same in both.
 */
export const SCENE_HELPERS = String.raw`
  var norm = function (t) { return String(t).toLowerCase().replace(/[.,:;!?()\[\]{}"'\u2026\u2013\u2014-]/g, ' ').replace(/\s+/g, ' ').trim(); };
  var asked = 0;
  nodecine.when = function (phrase, fallback) {
    var words = nodecine.words || [];
    var parts = norm(phrase).split(' ').filter(Boolean);
    var key = parts.reduce(function (a, b) { return b.length > a.length ? b : a; }, '');
    if (key.length >= 2) {
      for (var j = 0; j < words.length; j++) {
        var w = norm(words[j].text);
        if (w === key || w.indexOf(key) >= 0) return Math.max(0, words[j].start);
      }
    }
    if (typeof fallback === 'number') return fallback;
    // Nothing heard: spread the phrases asked for over the spoken part of the scene.
    var d = nodecine.duration || 4;
    return Math.min(d - 0.6, 0.45 + 0.9 * asked++);
  };
  // A number counts up to what the element already shows: same digits, same grouping, from zero.
  nodecine.count = function (target, vars) {
    var els = typeof target === 'string' ? Array.prototype.slice.call(nodecine.root.querySelectorAll(target)) : [].concat(target);
    var tl = gsap.timeline();
    els.forEach(function (el) {
      var text = el.textContent || '';
      var m = text.match(/-?[0-9][0-9.,]*/);
      if (!m) return;
      var raw = m[0];
      var decimals = (raw.split('.')[1] || '').length;
      var grouped = raw.indexOf(',') >= 0;
      var end = parseFloat(raw.replace(/,/g, ''));
      if (!isFinite(end)) return;
      var o = { v: 0 };
      tl.to(o, Object.assign({ v: end, duration: 1.2, ease: 'power2.out' }, vars || {}, { onUpdate: function () {
        var n = decimals ? o.v.toFixed(decimals) : String(Math.round(o.v));
        if (grouped) n = Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        el.textContent = text.replace(raw, n);
      } }), 0);
    });
    return tl;
  };
`;

/**
 * The gsap a scene's script receives: string targets resolve inside the scene only, so two scenes
 * that both name `.title` never reach into each other. Timelines handed to `nodecine.timeline`
 * are unwrapped for the master. Shared by the render document and the preview.
 */
export const SCOPED_GSAP = String.raw`
  function scopedGsap(root, unwrap) {
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
`;

/** `data-caption-style` on the scene's caption slot; karaoke unless it says reveal. */
export function captionStyleOf(slotTag: string): CaptionStyle {
  const m = /\bdata-caption-style=["']([a-z]+)["']/.exec(slotTag);
  const v = m?.[1] as CaptionStyle | undefined;
  return v && CAPTION_STYLES.includes(v) ? v : 'karaoke';
}

/**
 * What every caption needs regardless of scene (a line starts hidden, words sit inline), plus the
 * default band for a scene that declares no slot: inside the portrait safe zone, in the film's body
 * font and foreground, the spoken word in the accent colour. A scene that has its own slot styles
 * it in its own CSS and may set `--caption-on` for the highlight.
 */
export function captionStyles(width: number, height: number, withDefaultSlot: boolean): string {
  const portrait = height > width;
  const size = Math.round((portrait ? width : height) * 0.042);
  return [
    // Hidden lines must not take up room: every line is anchored to the slot's bottom edge, so the
    // one that is showing sits where the scene put the slot, whatever came before it.
    `.nc-cap-line { position: absolute; left: 0; right: 0; bottom: 0; visibility: hidden; opacity: 0; text-wrap: balance; }`,
    `.nc-cap-w { display: inline-block; }`,
    ...(withDefaultSlot
      ? [`.nc-captions-default { position: absolute; left: ${portrait ? 72 : 96}px; right: ${portrait ? 168 : 96}px; bottom: ${portrait ? 720 : 96}px; text-align: center; font: 700 ${size}px/1.3 var(--font-body, sans-serif); color: color-mix(in srgb, var(--fg, #fff) 82%, transparent); text-shadow: 0 2px 12px rgba(0,0,0,.55); pointer-events: none; }`]
      : []),
  ].join('\n');
}

/** One caption line's markup: a span per word, hidden until the voice reaches it when the style is reveal. */
export function captionLine(id: string | null, words: { id?: string; text: string }[], style: CaptionStyle): string {
  const spans = words.map((w) => `<span${w.id ? ` id="${w.id}"` : ''} class="nc-cap-w"${style === 'reveal' ? ' style="opacity:0"' : ''}>${esc(w.text)}</span>`).join(' ');
  return `<div${id ? ` id="${id}"` : ''} class="nc-cap-line">${spans}</div>`;
}

/**
 * One scene's markup on the page: captions in its slot (or the default band when it has none),
 * the videos in it timed to the scene.
 */
export function sceneMarkup(source: string, o: { captionsHtml?: string; withCaptions: boolean; start: number; duration: number }): { html: string; styles: string[]; scripts: string[]; captionSlot: { tag: string } | null } {
  const code = splitCode(source);
  const captionSlot = findSlot(code.markup, CAPTION_SLOT);
  const withBand = o.withCaptions && !captionSlot ? `${code.markup}<div class="${DEFAULT_CAPTION_BAND_CLASS}" data-slot="${CAPTION_SLOT}"></div>` : code.markup;
  const withCaps = o.captionsHtml ? fillNamedSlot(withBand, CAPTION_SLOT, o.captionsHtml) : withBand;
  return { html: timeVideos(withCaps, o.start, o.duration), styles: code.styles, scripts: code.scripts, captionSlot };
}

/** What HyperFrames needs beyond the contract's options: where the fonts are, and whether to run the script on a loop. */
export interface PreviewOptions extends ScenePreviewOptions {
  fontBase?: string;
  /** Run the scene's script on a looping timeline; needs gsap's source inlined. */
  animate?: { gsapSource: string; loopSeconds?: number };
}

/**
 * Plays the scene's script in the preview, the way the engine does at run time: the script gets a
 * gsap scoped to the scene and hands its timeline to `nodecine.timeline`; the master loops so the
 * motion can be judged without a render.
 */
export const ANIMATE_SCRIPT = String.raw`
(function () {
  if (typeof gsap === 'undefined') return;
  var d = JSON.parse(document.getElementById('nodecine-data').textContent);
  var root = document.querySelector('.nc-scene');
  var unwrap = new WeakMap();
  __SCOPED_GSAP__
  var g = scopedGsap(root, unwrap);
  var timelines = [];
  var nodecine = { timeline: function (tl) { timelines.push(unwrap.get(tl) || tl); }, root: root, index: 0, duration: d.loop || 4, words: [] };
  __SCENE_HELPERS__
  (d.scripts || []).forEach(function (src) { try { new Function('gsap', 'nodecine', 'root', src)(g, nodecine, root); } catch (e) { console.error('[nodecine] preview script failed:', e); } });
  var master = gsap.timeline({ repeat: -1, repeatDelay: 1 });
  timelines.forEach(function (tl) { tl.paused(false); master.add(tl, 0); });
  // The sample caption: the line shows early and its words light up spread over the loop, as the render does to the voice.
  if (d.captions) {
    var line = root.querySelector('.nc-cap-line');
    if (line) {
      master.set(line, { autoAlpha: 1 }, 0.15);
      var ws = Array.prototype.slice.call(line.querySelectorAll('.nc-cap-w'));
      var span = Math.max(0.5, (d.loop || 4) - 1.0);
      ws.forEach(function (el, i) {
        var at = 0.4 + (span * i) / Math.max(1, ws.length);
        if (d.captions.style === 'reveal') master.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, at);
        else master.set(el, { color: 'var(--caption-on, var(--accent))' }, at);
      });
    }
  }
  master.set({}, {}, d.loop || 4);
})();
`.replace('__SCOPED_GSAP__', SCOPED_GSAP).replace('__SCENE_HELPERS__', SCENE_HELPERS);

/**
 * A still (or, with `animate`, a loop) of one scene for the Studio: the same markup the engine
 * uses, the video's values bound, in a page the caller sandboxes; it loads only its fonts.
 */
export function buildScenePreview(o: PreviewOptions): string {
  const width = o.width ?? 1080;
  const height = o.height ?? 1920;
  const loop = o.animate?.loopSeconds ?? 4;
  const scene = sceneMarkup(o.source, { withCaptions: !!o.captions, start: 0, duration: loop });
  const captionStyle = captionStyleOf(scene.captionSlot?.tag ?? '');
  const captionHtml = o.captions ? captionLine(null, o.captions.trim().split(/\s+/).filter(Boolean).map((text) => ({ text })), captionStyle) : '';
  const markup = captionHtml ? fillNamedSlot(scene.html, 'captions', captionHtml) : scene.html;
  const styles = [
    baseStyles(width, height, o.fontBase ?? '/fonts'),
    o.captions ? baseLayer(captionStyles(width, height, !scene.captionSlot)) : '',
    styleCss(o.style),
    scopedCss('[data-scene]', scene.styles.join('\n')),
  ].filter(Boolean);
  const data = JSON.stringify({ vars: o.vars ?? {}, facts: o.facts ?? {}, scripts: o.animate ? scene.scripts : [], loop, ...(o.captions ? { captions: { style: captionStyle } } : {}) }).replace(/</g, '\\u003c');
  return [
    `<!doctype html>`,
    `<html data-resolution="${height > width ? 'portrait' : 'landscape'}">`,
    `<head><meta charset="utf-8">`,
    // The animate script runs the scene's script through `new Function`, which a CSP without
    // 'unsafe-eval' refuses in silence; the render document allows it for the same reason.
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'${o.animate ? " 'unsafe-eval'" : ''}; style-src 'unsafe-inline'; img-src http: https: data: blob:; media-src http: https: blob: data:; font-src http: https: data:; connect-src 'none'">`,
    `<style>\n${styles.join('\n')}\n</style></head>`,
    `<body><div data-composition-id="preview" data-width="${width}" data-height="${height}">`,
    `<div class="nc-scene" data-scene="preview">${markup}</div>`,
    `</div>`,
    `<script type="application/json" id="nodecine-data">${data}</script>`,
    `<script>${BIND_SCRIPT}</script>`,
    `<script>(function(){var d=JSON.parse(document.getElementById('nodecine-data').textContent);var root=document.querySelector('.nc-scene');window.__nodecineBind.vars(root,d.vars);window.__nodecineBind.facts(root,d.facts);})();</script>`,
    ...(o.animate ? [`<script>${o.animate.gsapSource}</script>`, `<script>${ANIMATE_SCRIPT}</script>`] : []),
    `</body></html>`,
  ].join('\n');
}
