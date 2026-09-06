import { describe, expect, it } from 'vitest';
import { buildHyperframesDocument, fillSlot, splitCode, tokenVars, COMPOSITION_ID } from './document';
import type { VideoIR } from '@/core/types/ir';
import { DEFAULT_STAGE } from '@/nodes/look/node';
import { DEFAULT_BLOCK } from '@/nodes/look/blocks';

const ir: VideoIR = {
  irVersion: 1,
  meta: { title: 'T', language: 'en', fps: 30, width: 1080, height: 1920, totalDurationInFrames: 300 },
  stage: DEFAULT_STAGE,
  blocks: [DEFAULT_BLOCK],
  audioTrack: { voiceoverUrl: '/api/media/0123456789abcdef.mp3', durationSeconds: 9.5, padTailFrames: 15 },
  timeline: [
    { id: 'scene-1-text-card', blockId: 'text-card', startFrame: 0, durationInFrames: 90, props: { headline: 'One <b>', body: 'First' }, fields: { kicker: 'HI' } },
    { id: 'scene-2-text-card', blockId: 'text-card', startFrame: 90, durationInFrames: 210, props: { headline: 'Two' }, tone: 'warm' },
  ],
};
const count = (hay: string, needle: string) => hay.split(needle).length - 1;
const opts = { gsapSource: '/*gsap*/', runtimeSource: '/*runtime*/', voiceoverSrc: '/api/media/0123456789abcdef.mp3', fontBase: '/fonts' };

describe('splitCode / fillSlot / tokenVars', () => {
  it('separates markup, style and script', () => {
    const r = splitCode('<style>.a{}</style><div class="a"></div><script>nodecine.timeline(1)</script>');
    expect(r).toEqual({ markup: '<div class="a"></div>', styles: ['.a{}'], scripts: ['nodecine.timeline(1)'] });
  });
  it('drops the block into the stage slot', () => {
    expect(fillSlot('<div><p data-slot="content"></p></div>', '<b>x</b>')).toBe('<div><p data-slot="content"><b>x</b></p></div>');
  });
  it('turns tokens into CSS variables and lets a tone override the palette', () => {
    expect(tokenVars(DEFAULT_STAGE)).toContain('--accent: #7c5cff');
    expect(tokenVars(DEFAULT_STAGE)).toContain("--font-display: 'JetBrains Mono'");
    expect(tokenVars(DEFAULT_STAGE, 'warm')).toContain('--accent: #e3b341');
  });
});

describe('buildHyperframesDocument', () => {
  const html = buildHyperframesDocument(ir, opts);
  // The markup alone: the data island repeats the scene scripts, so counts are taken without it.
  const markup = html.replace(/<script type="application\/json" id="nodecine-data">[\s\S]*?<\/script>/, '').replace(/<script>[\s\S]*?<\/script>/g, '');

  it('is one self-contained composition with one timed clip per scene and the voice-over', () => {
    expect(html).toContain(`data-composition-id="${COMPOSITION_ID}" data-start="0" data-duration="10" data-width="1080" data-height="1920" data-fps="30"`);
    expect(html).toContain('<html lang="en" data-resolution="portrait">');
    expect(html).toContain('<div id="scene-1-text-card" class="clip nc-scene" data-start="0" data-duration="3" data-track-index="0" data-stage');
    expect(html).toContain('<div id="scene-2-text-card" class="clip nc-scene" data-start="3" data-duration="7" data-track-index="0" data-stage data-tone="warm"');
    expect(html).toContain('<audio id="voiceover" data-start="0" data-duration="9.5" data-track-index="1" src="/api/media/0123456789abcdef.mp3">');
    expect(count(markup, 'data-slot="content"')).toBe(2);
    expect(count(markup, 'class="nc-block" data-block="text-card"')).toBe(2);
  });

  it('inlines gsap then the runtime in the head, before anything registers a timeline, and marks the runtime so the player and producer do not add another', () => {
    expect(html).toContain('<script>/*gsap*/</script>');
    expect(html.indexOf('/*gsap*/')).toBeLessThan(html.indexOf('/*runtime*/'));
    expect(html.indexOf('/*runtime*/')).toBeLessThan(html.indexOf('id="nodecine-data"'));
    expect(html).toContain('<script data-hyperframes-preview-runtime>/*runtime*/</script>');
    expect(html).toContain('hyperframe.runtime.iife.js');
    expect(html).not.toContain('cdn.jsdelivr');
  });

  it('scopes the stage and block styles and puts tokens on the root and tones on the clip', () => {
    expect(html).toContain('@scope ([data-stage])');
    expect(html).toContain('@scope ([data-block="text-card"])');
    expect(html).toContain('[data-composition-id] { position: relative; width: 1080px; height: 1920px; overflow: hidden; background: var(--bg, #000); --bg: #0b0c10');
    expect(html).toMatch(/id="scene-2-text-card"[^>]*style="[^"]*--accent: #e3b341/);
  });

  it('carries props, fields and the scene scripts as data, with no script from the block left in the markup', () => {
    const data = JSON.parse(/<script type="application\/json" id="nodecine-data">([\s\S]*?)<\/script>/.exec(html)![1]!);
    expect(data.compositionId).toBe(COMPOSITION_ID);
    expect(data.duration).toBe(10);
    expect(data.scenes).toHaveLength(2);
    expect(data.scenes[0].props).toEqual({ headline: 'One <b>', body: 'First' });
    expect(data.scenes[0].fields).toEqual({ kicker: 'HI' });
    expect(data.scenes[0].scripts.join('\n')).toContain('nodecine.timeline');
    // The block's <script> is not left inline where the browser would run it out of scope.
    expect(markup).not.toContain('nodecine.timeline(');
    expect(html).not.toContain('One <b>');
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
    expect(html).toMatch(/<div class="nc-frame">\s*<div id="scene-1-text-card" class="clip nc-scene"/);
    expect(buildHyperframesDocument(ir, opts)).not.toContain('nc-frame');
  });
});
