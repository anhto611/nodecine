import type { VideoIR } from '@/core/types/ir';
import type { BlockDef, StageDef } from '@/core/types/payloads';

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
}

/** Marker the HyperFrames player looks for before deciding to inject a runtime of its own. */
export const RUNTIME_MARKER = '<!-- hyperframe.runtime.iife.js (inlined) -->';
export const COMPOSITION_ID = 'nodecine';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attr = (s: string) => esc(s);

/** Split a stage/block code fragment into markup, style text and script text. */
export function splitCode(source: string): { markup: string; styles: string[]; scripts: string[] } {
  const styles: string[] = [];
  const scripts: string[] = [];
  const markup = source
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css: string) => { styles.push(css.trim()); return ''; })
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, js: string) => { scripts.push(js.trim()); return ''; })
    .trim();
  return { markup, styles, scripts };
}

/** Put the block's markup inside the stage's `data-slot="content"` element. */
export function fillSlot(stageMarkup: string, inner: string): string {
  const m = /<([a-zA-Z][\w-]*)\b[^>]*\bdata-slot=["']content["'][^>]*>/.exec(stageMarkup);
  if (!m) return `${stageMarkup}${inner}`;
  const at = m.index + m[0].length;
  return `${stageMarkup.slice(0, at)}${inner}${stageMarkup.slice(at)}`;
}

/** Stage tokens as CSS custom properties: `palette.bg` → `--bg`, `fonts.display` → `--font-display`. */
export function tokenVars(stage: StageDef, tone?: string): string {
  const palette = { ...stage.tokens.palette, ...(tone && stage.tones[tone] ? stage.tones[tone] : {}) };
  const vars = [
    ...Object.entries(palette).map(([k, v]) => `--${k}: ${v}`),
    ...Object.entries(stage.tokens.fonts).map(([k, v]) => `--font-${k}: ${v}`),
  ];
  return vars.join('; ');
}

const scoped = (selector: string, css: string) => (css ? `@scope (${selector}) {\n${css}\n}` : '');

const fontFaces = (base: string) =>
  [
    ['400', 'JetBrainsMono-Regular.woff2'],
    ['700', 'JetBrainsMono-Bold.woff2'],
    ['800', 'JetBrainsMono-ExtraBold.woff2'],
  ]
    .map(([w, f]) => `@font-face { font-family: 'JetBrains Mono'; font-weight: ${w}; font-style: normal; font-display: block; src: url('${base}/${f}') format('woff2'); }`)
    .join('\n');

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

  function bindProps(root, props) {
    root.querySelectorAll('[data-if]').forEach(function (el) {
      var v = props[el.getAttribute('data-if')];
      var empty = v === undefined || v === null || v === false || v === '' || (Array.isArray(v) && v.length === 0);
      if (empty) el.remove();
    });
    root.querySelectorAll('[data-prop]').forEach(function (el) {
      var v = props[el.getAttribute('data-prop')];
      if (v === undefined || v === null) { el.textContent = ''; return; }
      if (Array.isArray(v)) {
        var template = el.firstElementChild;
        el.textContent = '';
        v.forEach(function (item) {
          if (template) { var c = template.cloneNode(true); c.textContent = String(item); el.appendChild(c); }
          else el.appendChild(document.createTextNode(String(item)));
        });
        return;
      }
      el.textContent = typeof v === 'number' ? v.toLocaleString('en-US') : String(v);
    });
  }

  function bindFields(root, fields) {
    root.querySelectorAll('[data-field]').forEach(function (el) {
      var v = fields[el.getAttribute('data-field')];
      if (v === undefined || v === null || v === '') el.remove();
      else el.textContent = String(v);
    });
  }

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
  master.set({}, {}, data.duration);
  window.__timelines = window.__timelines || {};
  window.__timelines[data.compositionId] = master;
})();
`;

export function buildHyperframesDocument(ir: VideoIR, o: DocumentOptions): string {
  const { width, height, fps, totalDurationInFrames } = ir.meta;
  const stage = ir.stage;
  const blocks = new Map(ir.blocks.map((b) => [b.id, b] as [string, BlockDef]));
  const stageCode = splitCode(stage.code.source);
  const blockCode = new Map([...blocks].map(([id, b]) => [id, splitCode(b.code.source)]));

  const duration = totalDurationInFrames / fps;
  const scenes = ir.timeline.map((s) => {
    const bc = blockCode.get(s.blockId)!;
    const inner = `<div class="nc-block" data-block="${attr(s.blockId)}">${bc.markup}</div>`;
    const markup = fillSlot(stageCode.markup, inner);
    return {
      id: s.id,
      start: s.startFrame / fps,
      duration: s.durationInFrames / fps,
      html: `<div id="${attr(s.id)}" class="clip nc-scene" data-start="${s.startFrame / fps}" data-duration="${s.durationInFrames / fps}" data-track-index="0" data-stage${s.tone ? ` data-tone="${attr(s.tone)}"` : ''} style="${attr(tokenVars(stage, s.tone))}">${markup}</div>`,
      data: { id: s.id, start: s.startFrame / fps, props: s.props, fields: s.fields ?? {}, scripts: [...stageCode.scripts, ...bc.scripts] },
    };
  });

  const styles = [
    fontFaces(o.fontBase),
    `* { margin: 0; padding: 0; box-sizing: border-box; }`,
    `html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: #000; }`,
    `[data-composition-id] { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; background: var(--bg, #000); ${tokenVars(stage)}; }`,
    `.clip { position: absolute; inset: 0; visibility: hidden; overflow: hidden; }`,
    `.nc-block { display: contents; }`,
    scoped('[data-stage]', stageCode.styles.join('\n')),
    ...[...blockCode].map(([id, bc]) => scoped(`[data-block="${id}"]`, bc.styles.join('\n'))),
  ].filter(Boolean);

  const data = { compositionId: COMPOSITION_ID, duration, scenes: scenes.map((s) => s.data) };

  // The page may load media and fonts, run its own inline scripts, and nothing else: no fetch, no
  // external scripts, no images from the network. The runtime is inlined for the same reason.
  const csp = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; media-src http: https: blob: data:; font-src http: https: data:; connect-src 'none'";

  // Script order matters: gsap, then the HyperFrames runtime, then the page. The runtime owns
  // `window.__timelines` (it installs a registry there), so a timeline registered before it loads
  // is lost, the producer waits its full readiness timeout, and nothing animates.
  return [
    `<!doctype html>`,
    `<html lang="${attr(ir.meta.language)}" data-resolution="${height > width ? 'portrait' : 'landscape'}">`,
    `<head>`,
    `<meta charset="utf-8">`,
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    `<meta name="viewport" content="width=${width}, height=${height}">`,
    `<title>${esc(ir.meta.title)}</title>`,
    `<script>${o.gsapSource}</script>`,
    RUNTIME_MARKER,
    `<script data-hyperframes-preview-runtime>${o.runtimeSource}</script>`,
    `<style>\n${styles.join('\n')}\n</style>`,
    `</head>`,
    `<body>`,
    `<div id="${COMPOSITION_ID}" data-composition-id="${COMPOSITION_ID}" data-start="0" data-duration="${duration}" data-width="${width}" data-height="${height}" data-fps="${fps}">`,
    ...scenes.map((s) => s.html),
    `<audio id="voiceover" data-start="0" data-duration="${ir.audioTrack.durationSeconds}" data-track-index="1" src="${attr(o.voiceoverSrc)}"></audio>`,
    `</div>`,
    `<script type="application/json" id="nodecine-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`,
    `<script>${BOOTSTRAP}</script>`,
    `</body>`,
    `</html>`,
  ].join('\n');
}
