import type { BlockDef, StageDef } from '../types/payloads';

/**
 * The markup side of the look (CORE_CONTRACTS §2.8), shared by every engine and by the Studio's
 * previews: how a stage's and a block's code splits into markup, style and script; how a block goes
 * into the stage's slot; how tokens become CSS variables; and the script that binds props into the
 * markup inside the page. Pure strings; no DOM, no engine.
 */

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
  return fillNamedSlot(stageMarkup, 'content', inner);
}

/** The opening tag of `data-slot="<name>"` in the markup, or null. */
export function findSlot(markup: string, name: string): { index: number; tag: string } | null {
  const m = new RegExp(`<([a-zA-Z][\\w-]*)\\b[^>]*\\bdata-slot=["']${name}["'][^>]*>`).exec(markup);
  return m ? { index: m.index, tag: m[0] } : null;
}

/** Drops `inner` into the named slot; a stage without that slot gets it appended at the end. */
export function fillNamedSlot(markup: string, name: string, inner: string): string {
  const slot = findSlot(markup, name);
  if (!slot) return `${markup}${inner}`;
  const at = slot.index + slot.tag.length;
  return `${markup.slice(0, at)}${inner}${markup.slice(at)}`;
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

export const scopedCss = (selector: string, css: string): string => (css ? `@scope (${selector}) {\n${css}\n}` : '');

export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const fontFaces = (base: string): string =>
  [
    ['400', 'JetBrainsMono-Regular.woff2'],
    ['700', 'JetBrainsMono-Bold.woff2'],
    ['800', 'JetBrainsMono-ExtraBold.woff2'],
  ]
    .map(([w, f]) => `@font-face { font-family: 'JetBrains Mono'; font-weight: ${w}; font-style: normal; font-display: block; src: url('${base}/${f}') format('woff2'); }`)
    .join('\n');

/** The base styles every page that draws a stage shares. */
export function baseStyles(stage: StageDef, width: number, height: number, fontBase: string): string {
  return [
    fontFaces(fontBase),
    `* { margin: 0; padding: 0; box-sizing: border-box; }`,
    `html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: #000; }`,
    `[data-composition-id] { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; background: var(--bg, #000); ${tokenVars(stage)}; }`,
    `.nc-block { display: contents; }`,
  ].join('\n');
}

/** One scene's markup: the stage around the block, the block tagged for scoping. */
export function sceneMarkup(stageMarkup: string, blockMarkup: string, blockId: string): string {
  return fillSlot(stageMarkup, `<div class="nc-block" data-block="${esc(blockId)}">${blockMarkup}</div>`);
}

/**
 * Binds props and fields into a scene root, in the page: `data-prop` takes the value (numbers in
 * en-US, arrays cloned from the first child), `data-if` removes the element when the prop is empty,
 * `data-field` takes a stage field or removes the element. Defined once as functions on `window.__nodecineBind`.
 */
export const BIND_SCRIPT = String.raw`
window.__nodecineBind = {
  props: function (root, props) {
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
  },
  fields: function (root, fields) {
    root.querySelectorAll('[data-field]').forEach(function (el) {
      var v = fields[el.getAttribute('data-field')];
      if (v === undefined || v === null || v === '') el.remove();
      else el.textContent = String(v);
    });
  }
};
`;

export interface PreviewOptions {
  stage: StageDef;
  /** The block to show in the slot; without one the stage shows a sample text card. */
  block?: BlockDef;
  props?: Record<string, unknown>;
  fields?: Record<string, string>;
  tone?: string;
  width?: number;
  height?: number;
  fontBase?: string;
  /** Report where the stage's top-level elements sit (postMessage to the parent), for the layout editor. */
  measure?: boolean;
  /** Run the stage's and block's scripts on a looping timeline; needs gsap's source inlined. */
  animate?: { gsapSource: string; loopSeconds?: number };
}

const SAMPLE_BLOCK_MARKUP = '<div style="display:flex;flex-direction:column;gap:32px"><div style="width:120px;height:10px;border-radius:5px;background:var(--accent)"></div><h1 style="font:800 88px/1.05 var(--font-display);color:var(--fg)">Headline</h1><p style="font:400 38px/1.4 var(--font-body);color:var(--muted)">One line under it.</p></div>';

/** Sample props for a block: its own `doc.example`, or one value per prop by type. */
export function sampleProps(block: BlockDef): Record<string, unknown> {
  try {
    const parsed = JSON.parse(block.doc.example) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    /* fall through */
  }
  const out: Record<string, unknown> = {};
  for (const [k, f] of Object.entries(block.props)) {
    out[k] = f.type === 'number' ? 12345 : f.type === 'boolean' ? true : f.type === 'color' ? '#7c5cff' : f.type === 'string[]' ? ['One', 'Two', 'Three'] : k;
  }
  return out;
}

/**
 * A still of one scene, for the Studio: the stage with a block in its slot, props bound, no
 * animation (the timeline's end state is what the code's CSS shows without gsap). Sandboxed by the
 * caller; the page itself loads only its fonts.
 */
/**
 * Posts the boxes of the stage root's direct children to the parent window: key (first class, or the
 * slot/field name), a label, and the frame-space rect. Runs after load and whenever the layout
 * changes. The parent checks the source window, so nothing else can spoof it.
 */
export const MEASURE_SCRIPT = String.raw`
(function () {
  var scene = document.querySelector('.nc-scene');
  if (!scene) return;
  var root = scene.firstElementChild;
  if (!root) return;
  function keyOf(el) {
    var cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean)[0];
    var label = el.getAttribute('data-slot') || el.getAttribute('data-field') || cls;
    if (cls) return { key: cls, label: label };
    if (el.hasAttribute('data-slot')) return { key: 'slot:' + el.getAttribute('data-slot'), label: label };
    if (el.hasAttribute('data-field')) return { key: 'field:' + el.getAttribute('data-field'), label: label };
    return null;
  }
  function report() {
    var base = scene.getBoundingClientRect();
    var rects = [];
    Array.prototype.forEach.call(root.children, function (el) {
      var k = keyOf(el);
      if (!k) return;
      var r = el.getBoundingClientRect();
      rects.push({ key: k.key, label: k.label, x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });
    });
    parent.postMessage({ type: 'nodecine:rects', rects: rects }, '*');
  }
  var raf = 0;
  function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(report); }
  schedule();
  window.addEventListener('load', schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  if (window.ResizeObserver) { var ro = new ResizeObserver(schedule); ro.observe(root); Array.prototype.forEach.call(root.children, function (el) { ro.observe(el); }); }
})();
`;

/**
 * Plays the stage's and block's scripts in the preview, the way the engine does at run time: each
 * script gets a gsap scoped to the scene and hands its timeline to `nodecine.timeline`; the master
 * loops so the motion can be judged without a render.
 */
export const ANIMATE_SCRIPT = String.raw`
(function () {
  if (typeof gsap === 'undefined') return;
  var d = JSON.parse(document.getElementById('nodecine-data').textContent);
  var root = document.querySelector('.nc-scene');
  var q = gsap.utils.selector(root);
  var fix = function (t) { return typeof t === 'string' ? q(t) : t; };
  var timelines = [];
  var unwrap = new WeakMap();
  var wrap = function (tl) {
    var proxy = new Proxy(tl, { get: function (target, key) {
      if (key === 'to' || key === 'from' || key === 'fromTo' || key === 'set') return function (t) { var a = Array.prototype.slice.call(arguments, 1); target[key].apply(target, [fix(t)].concat(a)); return proxy; };
      if (key === 'add') return function () { target.add.apply(target, arguments); return proxy; };
      var v = target[key]; return typeof v === 'function' ? v.bind(target) : v;
    } });
    unwrap.set(proxy, tl); return proxy;
  };
  var g = { timeline: function (v) { return wrap(gsap.timeline(v)); }, to: function (t, v) { return gsap.to(fix(t), v); }, from: function (t, v) { return gsap.from(fix(t), v); }, fromTo: function (t, a, b) { return gsap.fromTo(fix(t), a, b); }, set: function (t, v) { return gsap.set(fix(t), v); }, utils: gsap.utils, q: q };
  var nodecine = { timeline: function (tl) { timelines.push(unwrap.get(tl) || tl); }, props: d.props || {}, fields: d.fields || {}, root: root };
  (d.scripts || []).forEach(function (src) { try { new Function('gsap', 'nodecine', 'root', src)(g, nodecine, root); } catch (e) { console.error('[nodecine] preview script failed:', e); } });
  var master = gsap.timeline({ repeat: -1, repeatDelay: 1 });
  timelines.forEach(function (tl) { tl.paused(false); master.add(tl, 0); });
  master.set({}, {}, d.loop || 4);
})();
`;

export function buildLookPreview(o: PreviewOptions): string {
  const width = o.width ?? 1080;
  const height = o.height ?? 1920;
  const stage = splitCode(o.stage.code.source);
  const block = o.block ? splitCode(o.block.code.source) : null;
  const blockId = o.block?.id ?? 'sample';
  const markup = sceneMarkup(stage.markup, block ? block.markup : SAMPLE_BLOCK_MARKUP, blockId);
  const props = o.props ?? (o.block ? sampleProps(o.block) : {});
  const fields = o.fields ?? Object.fromEntries(o.stage.sceneFields.map((f) => [f.name, f.options?.[0] ?? f.name.toUpperCase()]));
  const styles = [
    baseStyles(o.stage, width, height, o.fontBase ?? '/fonts'),
    `.nc-scene { position: absolute; inset: 0; overflow: hidden; }`,
    scopedCss('[data-stage]', stage.styles.join('\n')),
    block ? scopedCss(`[data-block="${blockId}"]`, block.styles.join('\n')) : '',
  ].filter(Boolean);
  const data = JSON.stringify({ props, fields, scripts: o.animate ? [...stage.scripts, ...(block?.scripts ?? [])] : [], loop: o.animate?.loopSeconds ?? 4 }).replace(/</g, '\\u003c');
  return [
    `<!doctype html>`,
    `<html data-resolution="${height > width ? 'portrait' : 'landscape'}">`,
    `<head><meta charset="utf-8">`,
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src http: https: data: blob:; font-src http: https: data:; connect-src 'none'">`,
    `<style>\n${styles.join('\n')}\n</style></head>`,
    `<body><div data-composition-id="preview" data-width="${width}" data-height="${height}">`,
    `<div class="nc-scene" data-stage style="${esc(tokenVars(o.stage, o.tone))}">${markup}</div>`,
    `</div>`,
    `<script type="application/json" id="nodecine-data">${data}</script>`,
    `<script>${BIND_SCRIPT}</script>`,
    `<script>(function(){var d=JSON.parse(document.getElementById('nodecine-data').textContent);var root=document.querySelector('.nc-scene');window.__nodecineBind.fields(root,d.fields);var b=root.querySelector('[data-block]');if(b)window.__nodecineBind.props(b,d.props);})();</script>`,
    ...(o.animate ? [`<script>${o.animate.gsapSource}</script>`, `<script>${ANIMATE_SCRIPT}</script>`] : []),
    ...(o.measure ? [`<script>${MEASURE_SCRIPT}</script>`] : []),
    `</body></html>`,
  ].join('\n');
}
