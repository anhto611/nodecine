import type { ScenePreviewOptions } from '@/contracts/adapters/types';
import { BIND_SCRIPT, SCENE_HELPERS, SCOPED_GSAP, baseLayer, baseStyles, captionLine, captionStyleOf, captionStyles, fillNamedSlot, sceneMarkup, scopedCss, styleCss } from '@/contracts/visual/scene-markup';

/**
 * The HyperFrames capsule's own view of a scene: the shared machinery lives in the contracts
 * (`contracts/visual/scene-markup.ts`, the `html-gsap` format is theirs); this file re-exports it for
 * the page builder and adds the one thing only this engine draws — the Studio's scene preview.
 */
export * from '@/contracts/visual/scene-markup';

/** What HyperFrames needs beyond the contract's options: where the fonts are, and whether to run the script on a loop. */
export interface PreviewOptions extends ScenePreviewOptions {
  fontBase?: string;
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
