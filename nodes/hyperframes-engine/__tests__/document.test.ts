import { describe, expect, it } from 'vitest';
import { buildHyperframesDocument, splitCode, COMPOSITION_ID } from '../document';
import type { VideoIR } from '@/core/types/ir';
import { FACT_SOURCE, SCENE_SOURCE, STYLE } from '@/core/__tests__/scene-fixtures';

const ir: VideoIR = {
  irVersion: 2,
  meta: { title: 'T', language: 'en', fps: 30, width: 1080, height: 1920, totalDurationInFrames: 300 },
  style: STYLE,
  transition: { type: 'fade', seconds: 0.4 },
  vars: { channel: 'AIDev' },
  audioTrack: { voiceoverUrl: '/api/media/0123456789abcdef.mp3', durationSeconds: 9.5, padTailFrames: 15 },
  timeline: [
    { id: 'scene-1', startFrame: 0, durationInFrames: 90, source: SCENE_SOURCE },
    { id: 'scene-2', startFrame: 90, durationInFrames: 210, source: FACT_SOURCE, facts: { stars: 1284 } },
  ],
};
const count = (hay: string, needle: string) => hay.split(needle).length - 1;
const opts = { gsapSource: '/*gsap*/', runtimeSource: '/*runtime*/', voiceoverSrc: '/api/media/0123456789abcdef.mp3', fontBase: '/fonts' };
const dataOf = (html: string) => JSON.parse(/<script type="application\/json" id="nodecine-data">([\s\S]*?)<\/script>/.exec(html)![1]!);

describe('splitCode', () => {
  it('separates markup, style and script', () => {
    const r = splitCode('<style>.a{}</style><div class="a"></div><script>nodecine.timeline(1)</script>');
    expect(r).toEqual({ markup: '<div class="a"></div>', styles: ['.a{}'], scripts: ['nodecine.timeline(1)'] });
  });
});

describe('buildHyperframesDocument', () => {
  const html = buildHyperframesDocument(ir, opts);
  // The markup alone: the data island repeats the scene scripts, so counts are taken without it.
  const markup = html.replace(/<script type="application\/json" id="nodecine-data">[\s\S]*?<\/script>/, '').replace(/<script>[\s\S]*?<\/script>/g, '');

  it('is one self-contained composition with one timed clip per scene and the voice-over', () => {
    expect(html).toContain(`data-composition-id="${COMPOSITION_ID}" data-start="0" data-duration="10" data-width="1080" data-height="1920" data-fps="30"`);
    expect(html).toContain('<html lang="en" data-resolution="portrait">');
    // A fade of 0.4 s: every scene but the last stays mounted that much longer, the next one is drawn on top at the cut.
    expect(html).toContain('<div id="scene-1" class="clip nc-scene" data-scene="scene-1" data-start="0" data-duration="3.4" data-track-index="0">');
    expect(html).toContain('<div id="scene-2" class="clip nc-scene" data-scene="scene-2" data-start="3" data-duration="7" data-track-index="0">');
    expect(html).toContain('<audio id="voiceover" data-start="0" data-duration="9.5" data-track-index="1" src="/api/media/0123456789abcdef.mp3">');
    expect(count(markup, 'class="card"')).toBe(2);
    expect(markup).toContain('<h1 class="title">Hello</h1>');
  });

  it('inlines gsap then the runtime in the head, before anything registers a timeline, and marks the runtime so the player and producer do not add another', () => {
    expect(html).toContain('<script>/*gsap*/</script>');
    expect(html.indexOf('/*gsap*/')).toBeLessThan(html.indexOf('/*runtime*/'));
    expect(html.indexOf('/*runtime*/')).toBeLessThan(html.indexOf('id="nodecine-data"'));
    expect(html).toContain('<script data-hyperframes-preview-runtime>/*runtime*/</script>');
    expect(html).toContain('hyperframe.runtime.iife.js');
    expect(html).not.toContain('cdn.jsdelivr');
  });

  it("layers the cascade — engine defaults, then the film's style sheet scoped to the frame, then each scene's own styles unlayered and scoped to that scene", () => {
    expect(html).toContain('@layer nc-base, nc-style;');
    expect(html).toContain('@layer nc-style {\n@scope ([data-composition-id]) {\n.nc-scene { --bg: #0b0c10;');
    expect(html).toContain('@scope ([data-scene="scene-1"]) {\n.captions { position: absolute;');
    expect(html).not.toContain('@scope ([data-scene="scene-2"])');
    expect(html.indexOf('@layer nc-style {')).toBeLessThan(html.indexOf('@scope ([data-scene="scene-1"])'));
  });

  it('cuts clean on a cut, and carries the transition and the scene helpers for the others', () => {
    const cut = buildHyperframesDocument({ ...ir, transition: { type: 'cut', seconds: 0.4 } }, opts);
    expect(cut).toContain('<div id="scene-1" class="clip nc-scene" data-scene="scene-1" data-start="0" data-duration="3" data-track-index="0"');
    const data = dataOf(html);
    expect(data.transition).toEqual({ type: 'fade', seconds: 0.4 });
    expect(data.scenes[0].duration).toBe(3);
    expect(html).toContain('nodecine.when = function');
    expect(html).toContain('nodecine.count = function');
    expect(html).toContain("tr.type === 'fade'");
  });

  it('sends the pictures a scene names to the project, wherever they are named', () => {
    const shot = '/api/assets/0123456789abcdef0123456789abcdef01234567.png';
    const withShot = buildHyperframesDocument(
      { ...ir, timeline: [{ ...ir.timeline[0]!, source: `<img src="${shot}">` }, ir.timeline[1]!], vars: { character: shot } },
      { ...opts, assetBase: 'assets' },
    );
    // Rewritten to the copy the producer puts beside the page; the app path would not resolve there.
    expect(withShot).toContain('assets/0123456789abcdef0123456789abcdef01234567.png');
    expect(withShot).not.toContain('/api/assets/');
  });

  it('carries the values, the facts and the scene scripts as data, with no script left inline in the markup', () => {
    const data = dataOf(html);
    expect(data.compositionId).toBe(COMPOSITION_ID);
    expect(data.duration).toBe(10);
    expect(data.vars).toEqual({ channel: 'AIDev' });
    expect(data.scenes).toHaveLength(2);
    expect(data.scenes[0].facts).toEqual({});
    expect(data.scenes[1].facts).toEqual({ stars: 1284 });
    expect(data.scenes[0].scripts.join('\n')).toContain('nodecine.timeline');
    expect(data.scenes[1].scripts).toEqual([]);
    // The scene's <script> is not left inline where the browser would run it out of scope.
    expect(markup).not.toContain('nodecine.timeline(');
    expect(html).toContain('window.__nodecineBind.facts(root, scene.facts');
  });

  it('locks the page down with a CSP that allows inline code, media and fonts, and nothing else', () => {
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("script-src 'unsafe-inline' 'unsafe-eval'");
  });

  it('renders at a higher resolution by zooming the design frame, leaving the scenes in design pixels', () => {
    const html = buildHyperframesDocument(ir, { ...opts, scale: 2 });
    expect(html).toContain('data-width="2160" data-height="3840"');
    expect(html).toContain('<meta name="viewport" content="width=2160, height=3840">');
    expect(html).toContain('html, body, [data-composition-id] { width: 2160px; height: 3840px; }');
    expect(html).toContain('.nc-frame { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; transform: scale(2); transform-origin: 0 0;');
    // The scenes sit inside the design-sized frame, not directly in the root.
    expect(html).toMatch(/<div class="nc-frame">\s*<div id="scene-1" class="clip nc-scene"/);
    expect(buildHyperframesDocument(ir, opts)).not.toContain('nc-frame');
  });
});
