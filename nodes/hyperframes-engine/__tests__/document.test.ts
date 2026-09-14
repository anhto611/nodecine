import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildHyperframesDocument, splitCode, COMPOSITION_ID } from '../document';
import type { VideoIR } from '@/contracts/types/ir';
import { migrateIR } from '@/contracts/types/migrate-ir';
import { FACT_SOURCE, SCENE_SOURCE, STYLE } from '@/contracts/__tests__/scene-fixtures';
import lumenV2 from '@/contracts/__tests__/fixtures/ir-v2-lumen.json';

const ir: VideoIR = {
  irVersion: 3,
  meta: { title: 'T', language: 'en', fps: 30, width: 1080, height: 1920, totalDurationInFrames: 300 },
  style: STYLE,
  vars: { channel: 'AIDev' },
  tracks: [
    {
      id: 'scenes',
      clips: [
        { id: 'scene-1', kind: 'code', startFrame: 0, durationInFrames: 90, format: 'html-gsap', source: SCENE_SOURCE },
        { id: 'scene-2', kind: 'code', startFrame: 90, durationInFrames: 210, format: 'html-gsap', source: FACT_SOURCE, facts: { stars: 1284 } },
      ],
    },
  ],
  beats: [
    { index: 0, startFrame: 0, durationInFrames: 90, clipId: 'scene-1' },
    { index: 1, startFrame: 90, durationInFrames: 210, clipId: 'scene-2' },
  ],
  // 9.5 s of voice under a 10 s film: the last half second is the tail.
  audio: [{ id: 'voice', role: 'voice', url: '/api/media/0123456789abcdef.mp3', startFrame: 0, durationInFrames: 285, gain: 1 }],
  transitions: { default: { name: 'fade', seconds: 0.4 } },
};
const count = (hay: string, needle: string) => hay.split(needle).length - 1;
const opts = { gsapSource: '/*gsap*/', runtimeSource: '/*runtime*/', fontBase: '/fonts' };
const dataOf = (html: string) => JSON.parse(/<script type="application\/json" id="nodecine-data">([\s\S]*?)<\/script>/.exec(html)![1]!);
/** The picture without the wiring: no data island, no scripts, no audio elements. */
const pictureOf = (html: string) => html
  .replace(/<script type="application\/json" id="nodecine-data">[\s\S]*?<\/script>/, '')
  .replace(/<script>[\s\S]*?<\/script>/g, '')
  .replace(/<audio[^>]*><\/audio>\n?/g, '');
const golden = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('splitCode', () => {
  it('separates markup, style and script', () => {
    const r = splitCode('<style>.a{}</style><div class="a"></div><script>nodecine.timeline(1)</script>');
    expect(r).toEqual({ markup: '<div class="a"></div>', styles: ['.a{}'], scripts: ['nodecine.timeline(1)'] });
  });
});

describe('buildHyperframesDocument', () => {
  const html = buildHyperframesDocument(ir, opts);
  // The markup alone: the data island repeats the scene scripts, so counts are taken without it.
  const markup = pictureOf(html);

  it('is one self-contained composition with one timed clip per scene on the scenes track and the voice on its own track', () => {
    expect(html).toContain(`data-composition-id="${COMPOSITION_ID}" data-start="0" data-duration="10" data-width="1080" data-height="1920" data-fps="30"`);
    expect(html).toContain('<html lang="en" data-resolution="portrait">');
    // A fade of 0.4 s: every scene but the last stays mounted that much longer, the next one is drawn on top at the cut.
    expect(html).toContain('<div id="scene-1" class="clip nc-scene" data-scene="scene-1" data-start="0" data-duration="3.4" data-track-index="0">');
    expect(html).toContain('<div id="scene-2" class="clip nc-scene" data-scene="scene-2" data-start="3" data-duration="7" data-track-index="0">');
    expect(html).toContain('<audio id="voice" data-start="0" data-duration="9.5" data-track-index="1" src="/api/media/0123456789abcdef.mp3">');
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

  it('cuts clean on a cut, and carries the transitions, the beats and the scene helpers for the others', () => {
    const cut = buildHyperframesDocument({ ...ir, transitions: { default: { name: 'cut', seconds: 0.4 } } }, opts);
    expect(cut).toContain('<div id="scene-1" class="clip nc-scene" data-scene="scene-1" data-start="0" data-duration="3" data-track-index="0"');
    const data = dataOf(html);
    expect(data.transitions).toEqual({ default: { name: 'fade', seconds: 0.4 } });
    expect(data.scenes[0].duration).toBe(3);
    expect(data.beats.map((b: { clipId: string; start: number }) => [b.clipId, b.start])).toEqual([['scene-1', 0], ['scene-2', 3]]);
    expect(html).toContain('nodecine.when = function');
    expect(html).toContain('nodecine.count = function');
    expect(html).toContain('"fade": function (master, el, prev, t, d)');
    // Every clip's script can see the beats, and a beat clip knows which beat is its own.
    expect(html).toContain('beats: data.beats || [], beat: beat');
  });

  it('applies a transition named for one boundary there and the default elsewhere', () => {
    const three: VideoIR = {
      ...ir,
      meta: { ...ir.meta, totalDurationInFrames: 390 },
      tracks: [{ id: 'scenes', clips: [...ir.tracks[0]!.clips, { id: 'scene-3', kind: 'code', startFrame: 300, durationInFrames: 90, format: 'html-gsap', source: '<p>end</p>' }] }],
      beats: [...ir.beats, { index: 2, startFrame: 300, durationInFrames: 90, clipId: 'scene-3' }],
      transitions: { default: { name: 'fade', seconds: 0.4 }, at: [{ afterClipId: 'scene-2', name: 'cut', seconds: 0.1 }] },
    };
    const html3 = buildHyperframesDocument(three, opts);
    // scene-1 → scene-2 fades, so scene-1 stays up 0.4 s longer; scene-2 → scene-3 cuts, so scene-2 does not.
    expect(html3).toContain('data-scene="scene-1" data-start="0" data-duration="3.4"');
    expect(html3).toContain('data-scene="scene-2" data-start="3" data-duration="7"');
    expect(dataOf(html3).transitions.at).toEqual([{ afterClipId: 'scene-2', name: 'cut', seconds: 0.1 }]);
  });

  it('sends the pictures a scene names to the project, wherever they are named', () => {
    const shot = '/api/assets/0123456789abcdef0123456789abcdef01234567.png';
    const [first, second] = ir.tracks[0]!.clips as [Extract<VideoIR['tracks'][0]['clips'][0], { kind: 'code' }>, VideoIR['tracks'][0]['clips'][0]];
    const withShot = buildHyperframesDocument(
      { ...ir, tracks: [{ id: 'scenes', clips: [{ ...first, source: `<img src="${shot}">` }, second] }], vars: { character: shot } },
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

  it('lets a render point every sound at the file beside the page', () => {
    const html = buildHyperframesDocument(ir, { ...opts, mediaSrc: (url) => (url.endsWith('.mp3') ? 'audio-voice.mp3' : url) });
    expect(html).toContain('<audio id="voice" data-start="0" data-duration="9.5" data-track-index="1" src="audio-voice.mp3">');
  });
});

describe('what version 3 draws that version 2 could not', () => {
  it('a media clip under every scene on its own track, muted, framed by the film', () => {
    const under: VideoIR = {
      ...ir,
      tracks: [{ id: 'background', clips: [{ id: 'gameplay', kind: 'media', startFrame: 0, durationInFrames: 300, url: '/api/media/abcdefabcdefabcd.mp4', offsetSeconds: 0, fit: 'cover', loop: true, gain: 0 }] }, ...ir.tracks],
    };
    const html = buildHyperframesDocument(under, opts);
    expect(html).toContain('<video id="gameplay" class="clip nc-media" data-start="0" data-duration="10" data-track-index="0" src="/api/media/abcdefabcdefabcd.mp4" style="object-fit: cover" muted loop playsinline></video>');
    // A file started twelve seconds in, with its own sound, is told so in the runtime's words.
    const trimmed = buildHyperframesDocument({ ...under, tracks: [{ id: 'background', clips: [{ ...under.tracks[0]!.clips[0]!, offsetSeconds: 12, gain: 0.5, loop: false } as VideoIR['tracks'][0]['clips'][0]] }, ...ir.tracks] }, opts);
    expect(trimmed).toContain('style="object-fit: cover" data-media-start="12" data-volume="0.5" playsinline></video>');
    // The scenes moved up a track, the voice above them all.
    expect(html).toContain('data-scene="scene-1" data-beat="" data-start="0" data-duration="3.4" data-track-index="1"');
    expect(html).toContain('<audio id="voice" data-start="0" data-duration="9.5" data-track-index="2"');
    expect(html).toContain('.nc-media { width: 100%; height: 100%; display: block; }');
    // A media clip is not a scene: no captions, no script, not in the data island.
    expect(dataOf(html).scenes.map((s: { id: string }) => s.id)).toEqual(['scene-1', 'scene-2']);
    // With something under them the scenes lose their ground, and only they: a beat clip is marked, a layer's drawing is not.
    expect(html).toContain('[data-composition-id] .nc-scene[data-beat] { background: transparent; }');
    expect(html).toContain('data-scene="scene-1" data-beat=""');
    expect(buildHyperframesDocument(ir, opts)).not.toContain('background: transparent; }');
  });

  it('a second sound beside the voice, on a track of its own, at its level, looped, from inside the file, faded on the master timeline', () => {
    const scored: VideoIR = { ...ir, audio: [...ir.audio, { id: 'music', role: 'music', url: '/api/media/0000000000000001.mp3', startFrame: 0, durationInFrames: 300, gain: 0.2, loop: true, offsetSeconds: 8, fadeInSeconds: 1, fadeOutSeconds: 2 }] };
    const html = buildHyperframesDocument(scored, opts);
    expect(html).toContain('<audio id="voice" data-start="0" data-duration="9.5" data-track-index="1" src=');
    expect(html).toContain('<audio id="music" data-start="0" data-duration="10" data-track-index="2" data-volume="0.2" data-media-start="8" loop src=');
    // The voice has no fade and is not in the fade list; the music is, with what the bootstrap needs.
    expect(dataOf(html).audio).toEqual([{ id: 'music', start: 0, duration: 10, gain: 0.2, fadeIn: 1, fadeOut: 2 }]);
    // A track that ducks is told when the voice speaks: the whole voice here, since this film has no captions.
    const ducked = buildHyperframesDocument({ ...scored, audio: [scored.audio[0]!, { ...scored.audio[1]!, duck: { by: 'voice', to: 0.05 } }] }, opts);
    expect(dataOf(ducked).audio[0].duck).toEqual({ to: 0.05, windows: [[0, 9.5]] });
    expect(ducked).toContain("master.to(el, { volume: a.duck.to, duration: 0.25, ease: 'none' }, from)");
    expect(html).toContain("master.fromTo(el, { volume: 0 }, { volume: a.gain, duration: fadeIn, ease: 'none' }, a.start)");
  });
});

describe('the other two formats', () => {
  it('inline their library only when a clip asks, and turn a Lottie clip into a scene', () => {
    const plain = buildHyperframesDocument(ir, { ...opts, libs: { lottie: '/*lottie*/', three: '/*three*/' } });
    expect(plain).not.toContain('/*lottie*/');
    expect(plain).not.toContain('/*three*/');
    const json = JSON.stringify({ v: '5.7.4', fr: 30, ip: 0, op: 60, w: 100, h: 100, layers: [] });
    const withLottie: VideoIR = { ...ir, tracks: [{ id: 'anim', clips: [{ id: 'logo', kind: 'code', startFrame: 0, durationInFrames: 300, format: 'lottie', source: json }] }, ...ir.tracks] };
    const html = buildHyperframesDocument(withLottie, { ...opts, libs: { lottie: '/*lottie*/', three: '/*three*/' } });
    expect(html).toContain('<script>/*lottie*/</script>');
    expect(html).not.toContain('/*three*/');
    expect(html.indexOf('/*gsap*/')).toBeLessThan(html.indexOf('/*lottie*/'));
    expect(html).toContain('<div id="logo" class="clip nc-scene" data-scene="logo"');
    expect(html).toContain('<div class="nc-lottie"></div>');
    expect(dataOf(html).scenes.find((s: { id: string }) => s.id === 'logo').scripts[0]).toContain('lottie.loadAnimation');
    const withThree: VideoIR = { ...ir, tracks: [{ id: 'gl', clips: [{ id: 'cube', kind: 'code', startFrame: 0, durationInFrames: 300, format: 'html-three', source: '<canvas id="c"></canvas><script>nodecine.frame(function(t){})</script>' }] }, ...ir.tracks] };
    expect(buildHyperframesDocument(withThree, { ...opts, libs: { three: '/*three*/' } })).toContain('<script>/*three*/</script>');
  });
});

describe('an analysed sound', () => {
  it('is inlined by track id and offered to every scene script as nodecine.audio', () => {
    const analysis = { 'music-1': { version: 1, fps: 30, sampleRate: 16000, bands: ['level', 'bass', 'mid', 'high'], frames: [[1, 0.5, 0.2, 0.1]] } };
    const html = buildHyperframesDocument(ir, { ...opts, analysis });
    expect(dataOf(html).analysis).toEqual(analysis);
    expect(html).toContain('audio: audioOf');
    expect(html).toContain('at: function (t) { return row((scene.start + (t || 0)) * an.fps); }');
    expect(dataOf(buildHyperframesDocument(ir, opts)).analysis).toEqual({});
  });
});

describe('the transition catalogue', () => {
  it('is inlined once, keyed by name, and a boundary draws by looking its name up', () => {
    const html = buildHyperframesDocument({ ...ir, transitions: { default: { name: 'fade', seconds: 0.4 }, at: [{ afterClipId: 'scene-1', name: 'wipe-left', seconds: 0.5 }] } }, opts);
    expect(html).toContain('"wipe-left": function (master, el, prev, t, d) { master.fromTo(el, { clipPath: \'inset(0 0 0 100%)\' }');
    expect(html).toContain('"iris": function (master, el, prev, t, d)');
    expect(html).toContain('var draw = catalog[tr.name];');
    expect(html).not.toContain("tr.name === 'fade'");
    expect(dataOf(html).transitions.at).toEqual([{ afterClipId: 'scene-1', name: 'wipe-left', seconds: 0.5 }]);
  });
});

describe('a layer\'s drawing beside the scenes', () => {
  const withLayer: VideoIR = { ...ir, tracks: [...ir.tracks, { id: 'device', clips: [{ id: 'phone', kind: 'code', startFrame: 0, durationInFrames: 300, format: 'html-gsap', source: '<div class="phone"></div>' }] }] };

  it('never paints the film\'s ground, so the scenes under it are seen', () => {
    const html = buildHyperframesDocument(withLayer, opts);
    expect(html).toContain('[data-composition-id] .nc-scene:not([data-beat]) { background: transparent; }');
    // The beats are marked so the rule can tell them apart; the layer is not.
    expect(html).toContain('data-scene="scene-1" data-beat=""');
    expect(html).toContain('<div id="phone" class="clip nc-scene" data-scene="phone" data-start="0"');
    // A film of scenes alone says nothing about grounds at all.
    expect(buildHyperframesDocument(ir, opts)).not.toContain('background: transparent');
    expect(buildHyperframesDocument(ir, opts)).not.toContain('data-beat');
  });
});

describe('a silent film', () => {
  it('has no audio element, and its scenes still get a clock and the helpers', () => {
    const silent: VideoIR = { ...ir, audio: [] };
    const html = buildHyperframesDocument(silent, opts);
    expect(html).not.toContain('<audio');
    expect(html).toContain('data-composition-id="nodecine" data-start="0" data-duration="10"');
    expect(dataOf(html).scenes.map((s: { words: unknown[] }) => s.words)).toEqual([[], []]);
    // `when` with nothing to hear spreads the asks over the scene; that path is in the helpers as shipped.
    expect(html).toContain('Nothing heard: spread the phrases asked for');
  });
});

describe('the migrated film is the same film', () => {
  // The version-2 builder's output on the Lumen promo, captured before the builder changed. The new
  // builder, fed the migrated IR, has to draw the same picture: same markup, same styles, same
  // clip timing. Only the wiring may differ — the data island and the bootstrap, which now speak
  // of tracks and beats, and the audio element, which now has a track of its own.
  const player = buildHyperframesDocument(migrateIR(lumenV2), { gsapSource: '/*gsap*/', runtimeSource: '/*runtime*/', fontBase: '/fonts' });
  const render = buildHyperframesDocument(migrateIR(lumenV2), { gsapSource: '/*gsap*/', runtimeSource: '/*runtime*/', mediaSrc: () => 'voiceover.mp3', fontBase: 'fonts', scale: 2, assetBase: 'assets' });

  it('draws the same picture for the player, byte for byte', () => {
    expect(pictureOf(player)).toBe(pictureOf(golden('lumen-v2.html')));
  });

  it('draws the same picture for the render, byte for byte', () => {
    expect(pictureOf(render)).toBe(pictureOf(golden('lumen-v2-render.html')));
  });

  it('hands the scenes the same timing, words, captions, facts and scripts', () => {
    const before = dataOf(golden('lumen-v2.html'));
    const after = dataOf(player);
    expect(after.duration).toBe(before.duration);
    expect(after.vars).toEqual(before.vars);
    expect(after.scenes).toHaveLength(before.scenes.length);
    before.scenes.forEach((scene: Record<string, unknown>, i: number) => {
      const { track, ...rest } = after.scenes[i];
      expect(track).toBe(0);
      expect(rest).toEqual(scene);
    });
    expect(after.transitions.default).toEqual({ name: before.transition.type, seconds: before.transition.seconds });
  });

  it('keeps the voice where it was, on the track after the scenes', () => {
    expect(golden('lumen-v2.html')).toContain('<audio id="voiceover" data-start="0" data-duration="29.31" data-track-index="1"');
    // The element is named for the track now, and 880 frames at 30 fps is the film: the voice ran
    // 29.31 s and is counted in whole frames, so it ends with the film and not a frame before.
    expect(player).toMatch(/<audio id="voice" data-start="0" data-duration="29\.3\d*" data-track-index="1" src="\/api\/media\//);
  });
});
