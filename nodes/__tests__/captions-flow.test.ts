import { beforeEach, describe, expect, it } from 'vitest';
import { Executor } from '@/core/engine/executor';
import { _resetNodeRegistry } from '@/core/nodes/definition';
import { _resetCodeRenderers, registerCodeRenderer } from '@/core/visual/renderers';
import { registerNodes } from '@/nodes';
import { makeFakeServices } from '@/core/__tests__/fakes';
import { SCENE_SOURCE, STYLE, illustratorAnswers } from '@/core/__tests__/scene-fixtures';
import { captionsToFrames } from '@/nodes/assembler/build-ir';
import { buildHyperframesDocument } from '@/nodes/hyperframes-engine/document';
import staticScript from '@/lib/first-run.json';
import type { Graph } from '@/core/engine/graph';
import type { VideoIR } from '@/core/types/ir';
import type { Voiceover } from '@/core/types/payloads';

/**
 * The whole subtitle path on the shipped Static Script template: Transcribe aligns (fake service),
 * Captions lays lines out, the Assembler puts them on the frame clock, the document draws them.
 */
const graph = () => structuredClone(staticScript.graph) as Graph;
const on = (g: Graph, ...ids: string[]) => { for (const n of g.nodes) if (ids.includes(n.id)) n.bypassed = false; return g; };
const off = (g: Graph, ...ids: string[]) => { for (const n of g.nodes) if (ids.includes(n.id)) n.bypassed = true; return g; };

beforeEach(() => {
  _resetNodeRegistry();
  _resetCodeRenderers();
  registerNodes();
  registerCodeRenderer('html-gsap', 'hyperframes', () => null);
});

describe('captions on the Static Script template', () => {
  it('ships on, and switched off the Assembler still renders without subtitles and nothing is blocked', async () => {
    expect(graph().nodes.filter((n) => n.id === 'transcribe' || n.id === 'captions').every((n) => !n.bypassed)).toBe(true);
    const services = makeFakeServices({ complete: illustratorAnswers() });
    const ex = new Executor(off(graph(), 'transcribe', 'captions'), services);
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    expect(ex.runtime('transcribe').state).toBe('bypassed');
    expect(ex.runtime('captions').state).toBe('bypassed');
    expect(ex.runtime('assembler').state).toBe('success');
    expect((ex.runtime('assembler').outputs.ir!.payload as VideoIR).captions).toBeUndefined();
    expect(services.calls.some((c) => c.name === 'alignWords')).toBe(false);
  });

  it('turned on: aligns the script words, lays out lines, and the IR carries them on the frame clock', async () => {
    const services = makeFakeServices({ complete: illustratorAnswers() });
    const ex = new Executor(on(graph(), 'transcribe', 'captions'), services);
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    const align = services.calls.find((c) => c.name === 'transcribe/align')!;
    expect(align.args[0]).toMatch(/^\/api\/media\//);
    expect(align.args[3]).toEqual({ model: 'small' });
    const vo = ex.runtime('transcribe').outputs.voiceover!.payload as Voiceover;
    expect(vo.words!.length).toBeGreaterThan(5);
    expect(vo.words!.map((w) => w.text).join(' ')).toBe(String(align.args[1]).trim().split(/\s+/).join(' '));
    const ir = ex.runtime('assembler').outputs.ir!.payload as VideoIR;
    expect(ir.captions!.cues.length).toBeGreaterThan(0);
    for (const cue of ir.captions!.cues) {
      expect(cue.durationInFrames).toBeGreaterThan(0);
      expect(cue.startFrame + cue.durationInFrames).toBeLessThanOrEqual(ir.meta.totalDurationInFrames);
      for (const w of cue.words) expect(w.durationInFrames).toBeGreaterThan(0);
    }
  });

  it('Captions without word timings fails with a fix, and a provider that already timed the words skips alignment', async () => {
    const services = makeFakeServices({ complete: illustratorAnswers() });
    const g = off(on(graph(), 'captions'), 'transcribe');
    // Wire Captions straight to the TTS engine, skipping Transcribe.
    g.edges = g.edges.filter((e) => e.id !== 'c3');
    g.edges.push({ id: 'x', source: 'tts', sourcePort: 'voiceover', target: 'captions', targetPort: 'voiceover' });
    const ex = new Executor(g, services);
    await ex.run();
    expect(ex.runtime('captions').state).toBe('error');
    expect(ex.runtime('captions').error).toMatchObject({ code: 'CAPTIONS_NO_WORDS' });

    const timed = makeFakeServices();
    const synth = timed.synthesize.bind(timed);
    timed.synthesize = async (...a) => ({ ...(await synth(...a)), words: [{ text: 'Hello', start: 0, end: 0.4 }, { text: 'there.', start: 0.4, end: 0.8 }] });
    const ex2 = new Executor(on(graph(), 'transcribe', 'captions'), timed);
    const { ok } = await ex2.run();
    expect(ok).toBe(true);
    expect(timed.calls.some((c) => c.name === 'alignWords')).toBe(false);
    expect((ex2.runtime('assembler').outputs.ir!.payload as VideoIR).captions!.cues[0]!.words.map((w) => w.text)).toEqual(['Hello', 'there.']);
  });
});

describe('captionsToFrames', () => {
  it('rounds to frames, gives every word at least one frame, and never runs past the end', () => {
    const track = { cues: [{ start: 0.22, end: 0.6, words: [{ text: 'Xin', start: 0.22, end: 0.22 }, { text: 'chào,', start: 0.22, end: 0.6 }] }, { start: 9.9, end: 12, words: [{ text: 'end', start: 9.9, end: 12 }] }] };
    const ir = captionsToFrames(track, 30, 300);
    expect(ir.cues[0]).toEqual({ startFrame: 7, durationInFrames: 11, words: [{ text: 'Xin', startFrame: 7, durationInFrames: 1 }, { text: 'chào,', startFrame: 7, durationInFrames: 11 }] });
    expect(ir.cues[1]!.startFrame + ir.cues[1]!.durationInFrames).toBeLessThanOrEqual(299);
  });
});

describe('the HyperFrames document with captions', () => {
  it('draws each line inside the caption slot of every scene it overlaps, with a span per word, and hands the timings to the bootstrap', async () => {
    const services = makeFakeServices({ complete: illustratorAnswers() });
    const ex = new Executor(on(graph(), 'transcribe', 'captions'), services);
    await ex.run();
    const ir = ex.runtime('assembler').outputs.ir!.payload as VideoIR;
    // The fake illustrator draws no caption slot, so every scene gets the default band; give the first its own slot.
    ir.timeline[0]!.source = `${ir.timeline[0]!.source}<div class="captions" data-slot="captions"></div>`;
    const html = buildHyperframesDocument(ir, { gsapSource: '/*gsap*/', runtimeSource: '/*rt*/', voiceoverSrc: 'vo.mp3', fontBase: '/fonts' });
    const cues = ir.captions!.cues;
    const perScene = ir.timeline.map((s) => cues.filter((c) => c.startFrame < s.startFrame + s.durationInFrames && c.startFrame + c.durationInFrames > s.startFrame));
    const expectedLines = perScene.reduce((n, cs) => n + cs.length, 0);
    expect(expectedLines).toBeGreaterThan(0);
    expect(html.split('class="nc-cap-line"').length - 1).toBe(expectedLines);
    expect(html.split('class="nc-cap-w"').length - 1).toBe(perScene.flat().reduce((n, c) => n + c.words.length, 0));
    // The first scene declares its own slot, so its lines sit inside it; the others get the default band.
    expect(html).toMatch(/<div class="captions" data-slot="captions"><div id="nc-cap-0-0" class="nc-cap-line">/);
    expect(html.split('class="nc-captions-default" data-slot="captions"').length - 1).toBe(ir.timeline.length - 1);
    expect(html).toContain('.nc-captions-default { position: absolute; left: 72px; right: 168px; bottom: 720px;');
    expect(html).toMatch(/@layer nc-base \{\n\.nc-cap-line/);
    const data = JSON.parse(/<script type="application\/json" id="nodecine-data">([\s\S]*?)<\/script>/.exec(html)![1]!) as { scenes: { captions: { id: string; show: number; hide: number; style: string; words: { id: string; at: number }[] }[] }[] };
    expect(data.scenes[0]!.captions[0]).toMatchObject({ id: 'nc-cap-0-0', style: 'karaoke' });
    expect(data.scenes[0]!.captions[0]!.words[0]).toMatchObject({ id: 'nc-cap-0-0-w0', at: 0 });
    expect(data.scenes[0]!.captions[0]!.hide).toBeGreaterThan(data.scenes[0]!.captions[0]!.show);
  });

  it('honours data-caption-style on a scene\'s own slot', async () => {
    const services = makeFakeServices({ complete: illustratorAnswers() });
    const ex = new Executor(on(graph(), 'transcribe', 'captions'), services);
    await ex.run();
    const ir = ex.runtime('assembler').outputs.ir!.payload as VideoIR;
    const reveal = { ...ir, timeline: ir.timeline.map((s) => ({ ...s, source: `${s.source}<div data-slot="captions" data-caption-style="reveal"></div>` })) };
    const html2 = buildHyperframesDocument(reveal, { gsapSource: '', runtimeSource: '', voiceoverSrc: 'vo.mp3', fontBase: '/fonts' });
    expect(html2).not.toContain('nc-captions-default');
    expect(html2).toContain('class="nc-cap-w" style="opacity:0"');
  });

  it('draws nothing extra when the IR has no captions', () => {
    const ir: VideoIR = { irVersion: 2, meta: { title: 't', language: 'en', fps: 30, width: 1080, height: 1920, totalDurationInFrames: 30 }, style: STYLE, transition: { type: 'cut', seconds: 0.1 }, audioTrack: { voiceoverUrl: '/api/media/0123456789abcdef.mp3', durationSeconds: 1, padTailFrames: 0 }, timeline: [{ id: 's1', startFrame: 0, durationInFrames: 30, source: SCENE_SOURCE }] };
    const html = buildHyperframesDocument(ir, { gsapSource: '', runtimeSource: '', voiceoverSrc: 'vo.mp3', fontBase: '/fonts' });
    expect(html).not.toContain('nc-cap-line');
    expect(html).not.toContain('nc-captions-default');
  });
});
