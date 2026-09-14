import { describe, expect, it } from 'vitest';
import { buildHyperframesDocument } from '../document';
import { SCENE_SOURCE, STYLE } from '@/contracts/__tests__/scene-fixtures';
import type { VideoIR } from '@/contracts/types/ir';

/**
 * Captions as the document draws them: each line inside the caption slot of every scene it overlaps,
 * a span per word, the timings handed to the bootstrap. The IR is written by hand, so this holds
 * whatever node ends up putting the lines on the frame clock.
 */

const PLAIN = '<div class="card"><h1 class="title">Two</h1></div>';
const words = (texts: string[], from: number) => texts.map((text, i) => ({ text, startFrame: from + i * 5, durationInFrames: 5 }));

function film(overrides: Partial<VideoIR> = {}): VideoIR {
  return {
    irVersion: 3,
    meta: { title: 't', language: 'en', fps: 30, width: 1080, height: 1920, totalDurationInFrames: 60 },
    style: { ...STYLE, captions: { left: 96, right: 96, bottom: 150, size: 46 } },
    tracks: [{ id: 'scenes', clips: [
      { id: 's1', kind: 'code', startFrame: 0, durationInFrames: 30, format: 'html-gsap', source: SCENE_SOURCE },
      { id: 's2', kind: 'code', startFrame: 30, durationInFrames: 30, format: 'html-gsap', source: PLAIN },
    ] }],
    beats: [{ index: 0, startFrame: 0, durationInFrames: 30, clipId: 's1' }, { index: 1, startFrame: 30, durationInFrames: 30, clipId: 's2' }],
    audio: [{ id: 'voice', role: 'voice', url: '/api/media/0123456789abcdef.mp3', startFrame: 0, durationInFrames: 60, gain: 1 }],
    transitions: { default: { name: 'cut', seconds: 0.1 } },
    captions: { cues: [
      { startFrame: 0, durationInFrames: 15, words: words(['one', 'two', 'three'], 0) },
      { startFrame: 30, durationInFrames: 10, words: words(['four', 'five'], 30) },
    ] },
    ...overrides,
  };
}

const build = (ir: VideoIR) => buildHyperframesDocument(ir, { gsapSource: '/*gsap*/', runtimeSource: '/*rt*/', fontBase: '/fonts' });

describe('the HyperFrames document with captions', () => {
  it('draws each line in the scene it belongs to, a span per word, and hands the timings to the bootstrap', () => {
    const html = build(film());
    expect(html.split('class="nc-cap-line"').length - 1).toBe(2);
    expect(html.split('class="nc-cap-w"').length - 1).toBe(5);
    // The first scene declares its own slot, so its line sits inside it; the second gets the default band.
    expect(html).toMatch(/<div class="captions" data-slot="captions"><div id="nc-cap-0-0" class="nc-cap-line">/);
    expect(html.split('class="nc-captions-default" data-slot="captions"').length - 1).toBe(1);
    expect(html).toMatch(/@layer nc-base \{\n\.nc-cap-line/);
    const data = JSON.parse(/<script type="application\/json" id="nodecine-data">([\s\S]*?)<\/script>/.exec(html)![1]!) as { scenes: { captions: { id: string; show: number; hide: number; style: string; words: { id: string; at: number }[] }[] }[] };
    expect(data.scenes[0]!.captions[0]).toMatchObject({ id: 'nc-cap-0-0', style: 'karaoke' });
    expect(data.scenes[0]!.captions[0]!.words[0]).toMatchObject({ id: 'nc-cap-0-0-w0', at: 0 });
    expect(data.scenes[0]!.captions[0]!.hide).toBeGreaterThan(data.scenes[0]!.captions[0]!.show);
  });

  it('puts the default band where the film\'s style agreed it, and the build\'s own default without one', () => {
    expect(build(film())).toContain('.nc-captions-default { position: absolute; left: 96px; right: 96px; bottom: 150px;');
    const { captions: _agreed, ...older } = STYLE;
    expect(build(film({ style: older }))).toContain('.nc-captions-default { position: absolute; left: 72px; right: 168px; bottom: 720px;');
  });

  it('honours data-caption-style on a scene\'s own slot', () => {
    const ir = film();
    const reveal: VideoIR = { ...ir, tracks: ir.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.kind === 'code' ? { ...c, source: `${PLAIN}<div data-slot="captions" data-caption-style="reveal"></div>` } : c)) })) };
    const html = build(reveal);
    expect(html).not.toContain('nc-captions-default');
    expect(html).toContain('class="nc-cap-w" style="opacity:0"');
  });

  it('draws nothing extra when the IR has no captions', () => {
    const html = build(film({ captions: undefined }));
    expect(html).not.toContain('nc-cap-line');
    expect(html).not.toContain('nc-captions-default');
  });
});
