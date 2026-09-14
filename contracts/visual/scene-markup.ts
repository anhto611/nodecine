import { CAPTION_STYLES, type CaptionBand, type CaptionStyle, type Style } from '../types/payloads';
import { CAPTION_SLOT, DEFAULT_CAPTION_BAND_CLASS, EMPH_CLASS, FACT_ATTR, SCENE_ROOT_CLASS, VAR_ATTR } from './contract';

/**
 * The markup side of a scene (CORE_CONTRACTS §2.8), shared by every engine and by the Studio's
 * previews: how a scene's source splits into markup, style and script; where captions go; the
 * fonts every page bundles; the script that binds the video's values into the markup inside the
 * page; and the script that runs a scene's own code with a gsap scoped to it. Pure strings; no DOM,
 * no engine. Core owns it because `html-gsap` is the core's format and two engines draw it.
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

/**
 * Two ways a clip loses the film's ground. Unlayered, so both beat the style sheet's
 * `.nc-scene { background: var(--bg) }`, which every style sheet is told to write.
 *
 * A layer's drawing is not a scene: it shares the scene root's class so the sheet's own classes
 * work inside it, and that class carries the ground. A layer over the scenes would then paint the
 * film's background across the whole frame and hide every scene under it — which is what happened on
 * 2026-09-11: a phone layer left a film with nothing on screen but the phone. A layer that wants a
 * ground paints one itself, in its own CSS, which is scoped to its clip and wins.
 */
export const LAYER_NO_GROUND_CSS = `[data-composition-id] .${SCENE_ROOT_CLASS}:not([data-beat]) { background: transparent; }`;

/** A beat clip over something drawn under it keeps its drawing and loses its ground, so the picture below shows. */
export const TRANSPARENT_GROUND_CSS = `[data-composition-id] .${SCENE_ROOT_CLASS}[data-beat] { background: transparent; }`;

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
 * The numbers the default band is built from: the film's own if the style agreed one, else this
 * build's default. One place, so the CSS, the box and whoever has to keep out of it all agree.
 */
function bandMetrics(width: number, height: number, band?: CaptionBand) {
  const portrait = height > width;
  return band
    ? { portrait, ...band }
    : { portrait, size: Math.round((portrait ? width : height) * 0.042), left: portrait ? 72 : 96, right: portrait ? 168 : 96, bottom: portrait ? 720 : 96 };
}

/**
 * Where the default caption band sits in the frame, in pixels from the top-left — two lines of it at
 * most, which is what a cue is allowed to wrap to. Anything else the film draws over the scenes has
 * to keep out of this box: on 2026-09-11 a phone drawn across the whole film covered every word the
 * voice said, and putting the words on top would only have covered the phone instead.
 */
export function captionBandBox(width: number, height: number, band?: CaptionBand): { x: number; y: number; width: number; height: number } {
  const m = bandMetrics(width, height, band);
  const tall = Math.round(m.size * 1.3 * 2);
  return { x: m.left, y: height - m.bottom - tall, width: width - m.left - m.right, height: tall };
}

/**
 * What every caption needs regardless of scene (a line starts hidden, words sit inline), plus the
 * default band for a scene that declares no slot: inside the portrait safe zone, in the film's body
 * font and foreground, the spoken word in the accent colour. A scene that has its own slot styles
 * it in its own CSS and may set `--caption-on` for the highlight.
 */
export function captionStyles(width: number, height: number, withDefaultSlot: boolean, band?: CaptionBand): string {
  const { portrait, size, left, right, bottom } = bandMetrics(width, height, band);
  return [
    // Hidden lines must not take up room: every line is anchored to the slot's bottom edge, so the
    // one that is showing sits where the scene put the slot, whatever came before it.
    `.nc-cap-line { position: absolute; left: 0; right: 0; bottom: 0; visibility: hidden; opacity: 0; text-wrap: balance; }`,
    `.nc-cap-w { display: inline-block; }`,
    ...(withDefaultSlot
      ? [`.nc-captions-default { position: absolute; left: ${left}px; right: ${right}px; bottom: ${bottom}px; text-align: center; font: 700 ${size}px/1.3 var(--font-body, sans-serif); color: color-mix(in srgb, var(--fg, #fff) 82%, transparent); text-shadow: 0 2px 12px rgba(0,0,0,.55); pointer-events: none; }`]
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

/**
 * One scene brought to life inside a page or a player: the video's values and the scene's facts
 * bound into its markup, its scripts run with a gsap scoped to it and the `nodecine` object —
 * `timeline`, `root`, `index`, `duration`, `words`, `when`, `count`, `beats`, `beat`, `audio` —
 * and every timeline handed to `nodecine.timeline` returned for the caller's master. Declared as a
 * function so the HyperFrames bootstrap and the Remotion clip run the very same code: `scene` is
 * the clip's data row (`id`, `index`, `start`, `duration`, `facts`, `words`, `scripts`), `data`
 * the film's (`vars`, `beats`, `analysis`). Needs `window.__nodecineBind` (BIND_SCRIPT) in place.
 */
export const SCENE_MOUNT = String.raw`
function mountScene(gsap, root, scene, data, unwrap) {
  __SCOPED_GSAP__
  window.__nodecineBind.vars(root, data.vars || {});
  window.__nodecineBind.facts(root, scene.facts || {});
  var g = scopedGsap(root, unwrap);
  var collected = [];
  var beat = null;
  for (var bi = 0; bi < (data.beats || []).length; bi++) { if (data.beats[bi].clipId === scene.id) { beat = data.beats[bi]; break; } }
  // The analysed sound, if the film has one: bands on the film's frames, or at a second of this scene.
  var audioOf = function (id) {
    var an = (data.analysis || {})[id];
    if (!an || !an.frames || !an.frames.length) return null;
    var row = function (frame) {
      var r = an.frames[Math.max(0, Math.min(an.frames.length - 1, Math.round(frame)))] || [0, 0, 0, 0];
      var out = {};
      (an.bands || ['level', 'bass', 'mid', 'high']).forEach(function (b, i) { out[b] = r[i] || 0; });
      return out;
    };
    return { fps: an.fps, frames: an.frames.length, bands: row, at: function (t) { return row((scene.start + (t || 0)) * an.fps); } };
  };
  // A clip on the beat track sees its own beat; a clip that spans the film sees them all and
  // reads each beat's stage to know where the script wants it (docs/IR_V3.md §5.2).
  var nodecine = { timeline: function (tl) { collected.push(unwrap.get(tl) || tl); }, root: root, index: scene.index || 0, duration: scene.duration || 0, words: scene.words || [], beats: data.beats || [], beat: beat, audio: audioOf };
  __SCENE_HELPERS__
  // A scene that draws itself each frame — a canvas, a Lottie player, a Three.js renderer — hands a
  // function to nodecine.frame; it is called with the second of the scene from a timeline that spans
  // it, so it runs on every seek, in the page and in a render alike, and never from a clock.
  var frames = [];
  nodecine.frame = function (fn) { if (typeof fn === 'function') frames.push(fn); };
  (scene.scripts || []).forEach(function (src) {
    try { new Function('gsap', 'nodecine', 'root', src)(g, nodecine, root); }
    catch (e) { console.error('[nodecine] scene ' + scene.id + ' script failed:', e); }
  });
  if (frames.length) {
    var driver = gsap.timeline();
    var tick = function () { var t = driver.time(); frames.forEach(function (fn) { try { fn(t); } catch (e) { console.error('[nodecine] scene ' + scene.id + ' frame failed:', e); } }); };
    driver.to({}, { duration: Math.max(0.01, scene.duration || 4), ease: 'none', onUpdate: tick, onStart: tick }, 0);
    collected.push(driver);
  }
  return collected;
}
`.replace('__SCOPED_GSAP__', SCOPED_GSAP).replace('__SCENE_HELPERS__', SCENE_HELPERS);

/**
 * A Lottie animation as a scene: its JSON, played by lottie-web into a box that fills the scene and
 * stepped by `nodecine.frame`, so the page and the render show the same frame at the same second
 * (the runtime's own Lottie adapter is not used: it seeks on the film's clock, this on the clip's).
 * `lottie` is a global the engine puts on the page.
 */
export function lottieScene(json: string, o: { loop?: boolean } = {}): string {
  let data: unknown;
  try { data = JSON.parse(json); } catch { return '<div class="nc-lottie nc-lottie-broken"></div><style>.nc-lottie-broken{position:absolute;inset:0;background:#300}</style>'; }
  const literal = JSON.stringify(data).replace(/</g, '\\u003c');
  return [
    '<div class="nc-lottie"></div>',
    '<style>.nc-lottie{position:absolute;inset:0}.nc-lottie svg{width:100%;height:100%}</style>',
    `<script>var __ncLottie = lottie.loadAnimation({ container: root.querySelector('.nc-lottie'), renderer: 'svg', loop: false, autoplay: false, animationData: ${literal} });`,
    // The clip's clock is the only one that may move this animation. The film runtime finds every
    // registered Lottie and seeks it on the film's clock, unclamped: a two-second animation inside a
    // thirteen-second layer is asked for frame 390 of 60, its layers fall out of range, and the scene
    // goes blank eleven seconds early. Every seek, whoever makes it, therefore renders the frame this
    // scene last asked for.
    `var __ncWant = 0, __ncRaw = __ncLottie.setCurrentRawFrameValue.bind(__ncLottie);`,
    `__ncLottie.setCurrentRawFrameValue = function () { __ncRaw(__ncWant); };`,
    // Stepped in frames, and never past the last one: a Lottie layer's out point is exclusive, so
    // seeking to its duration draws nothing at all.
    `nodecine.frame(function (t) {`,
    `  var last = Math.max(0, __ncLottie.totalFrames - 1);`,
    `  var f = t * __ncLottie.frameRate;`,
    `  __ncWant = ${o.loop ? 'last > 0 ? f % (last + 1) : 0' : 'Math.min(last, f)'};`,
    `  __ncRaw(__ncWant);`,
    `});</script>`,
  ].join('');
}

/** A clip's source as the fragment the scene machinery mounts, whatever its format says it is. */
export function sourceForFormat(format: string, source: string, o: { loop?: boolean } = {}): string {
  return format === 'lottie' ? lottieScene(source, o) : source;
}
