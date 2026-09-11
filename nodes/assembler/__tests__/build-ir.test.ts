import { describe, it, expect } from 'vitest';
import { buildIR, clockOf, resolveFacts } from '../build-ir';
import { AssemblerErrorCode } from '../errors';
import { NodeError } from '@/core/errors';
import { videoVars } from '@/core/visual/vars';
import { validateIR, IRInvalidError } from '@/core/types/validate-ir';
import { beatClipsOf, padTailFramesOf } from '@/core/types/ir';
import type { AudioTrackSpec, CaptionTrack, LayerSpec, ScenePlan, FactSheet, Voiceover } from '@/core/types/payloads';
import { FACT_SOURCE, SCENE_SOURCE, STYLE } from '@/core/__tests__/scene-fixtures';

const voiceover: Voiceover = {
  audioUrl: '/api/media/0123456789abcdef.mp3',
  durationSeconds: 11.2,
  voiceName: 'Samantha',
  language: 'en',
  speed: 1,
};

const plan: ScenePlan = {
  language: 'en',
  frame: { width: 1080, height: 1920 },
  style: STYLE,
  transition: { type: 'fade', seconds: 0.4 },
  vars: {},
  scenes: [
    { weight: 1, source: SCENE_SOURCE },
    { weight: 2, source: '<h1 class="title">B</h1>' },
    { weight: 1, source: '<h1 class="title">C</h1>' },
  ],
};

describe('buildIR', () => {
  it('builds a valid, self-contained IR matching the docs example', () => {
    const ir = buildIR({ plan, voiceover, params: { title: 't' } });
    expect(ir.irVersion).toBe(3);
    expect(ir.meta.totalDurationInFrames).toBe(336);
    expect(ir.beats.map((b) => [b.startFrame, b.durationInFrames])).toEqual([
      [0, 84],
      [84, 168],
      [252, 84],
    ]);
    expect(padTailFramesOf(ir)).toBe(0);
    // The voice is the one audio track a run makes, and a film of one track of scenes has one track.
    expect(ir.audio).toEqual([{ id: 'voice', role: 'voice', url: voiceover.audioUrl, startFrame: 0, durationInFrames: 336, gain: 1 }]);
    expect(ir.tracks.map((t) => t.id)).toEqual(['scenes']);
    expect(ir.meta.language).toBe('en');
    expect(ir.meta.width).toBe(1080);
    expect(ir.style.name).toBe('Dark');
    expect(ir.transitions).toEqual({ default: { name: 'fade', seconds: 0.4 } });
    expect(ir.beats.map((b) => b.clipId)).toEqual(['scene-1', 'scene-2', 'scene-3']);
    expect(beatClipsOf(ir)[0]!.source).toBe(SCENE_SOURCE);
    expect(beatClipsOf(ir)[0]!.facts).toBeUndefined();
    expect(validateIR(ir)).toEqual({ ok: true, warnings: [] });
  });

  it('a single scene is valid too', () => {
    const ir = buildIR({ plan: { ...plan, scenes: [plan.scenes[0]!] }, voiceover });
    expect(ir.beats).toHaveLength(1);
    expect(beatClipsOf(ir)[0]!.durationInFrames).toBe(336);
  });

  it('invariant 2: facts are resolved onto the scene, by fact key, for the data-fact elements', () => {
    const facts: FactSheet = {
      facts: { stars: 1284, url: 'github.com/a/b', description: '' },
      sourceLabel: 'github.com/a/b',
      fetchedAt: 'x',
      mode: 'fetched',
    };
    const p: ScenePlan = {
      ...plan,
      scenes: [{ weight: 1, source: FACT_SOURCE, factBindings: { number: 'stars', body: 'description', label: 'missing' } }],
    };
    const ir = buildIR({ plan: p, voiceover, facts });
    // Present and saying something; an empty description and a missing key leave the drawing as it is.
    expect(beatClipsOf(ir)[0]!.facts).toEqual({ number: 1284 });
  });

  it('without bindings or facts there is nothing to resolve', () => {
    expect(resolveFacts(undefined, { a: 2 })).toBeUndefined();
    expect(resolveFacts({ a: 'missing' }, { b: 2 })).toBeUndefined();
    expect(resolveFacts({ a: 'items.1.title' }, { items: [{ title: 'x' }, { title: 'y' }] })).toEqual({ a: 'y' });
  });

  it('invariant 5: a scene that is a whole page, not a fragment, is rejected', () => {
    const p: ScenePlan = { ...plan, scenes: [{ weight: 1, source: '<html><body>x</body></html>' }] };
    expect(() => buildIR({ plan: p, voiceover })).toThrow(IRInvalidError);
  });

  it('takes the frame from the plan', () => {
    const ir = buildIR({ plan: { ...plan, frame: { width: 1920, height: 1080 } }, voiceover });
    expect([ir.meta.width, ir.meta.height]).toEqual([1920, 1080]);
  });
});

describe('validateIR rejects a built IR broken by hand (the invariants are numbered as in docs/IR_V3.md §6)', () => {
  const base = () => buildIR({ plan, voiceover });
  it('4: the first beat not at frame 0', () => {
    const ir = base();
    ir.beats[0]!.startFrame = 1;
    expect(validateIR(ir)).toMatchObject({ ok: false });
  });
  it('4: a gap between beats', () => {
    const ir = base();
    ir.beats[1]!.startFrame += 1;
    const r = validateIR(ir);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violations.some((v) => v.startsWith('4:'))).toBe(true);
  });
  it('4: beats that do not add up to the film', () => {
    const ir = base();
    ir.meta.totalDurationInFrames += 1;
    const r = validateIR(ir);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violations.some((v) => v.startsWith('4:'))).toBe(true);
  });
  it('a zero-frame clip is blocked by the schema', () => {
    const ir = base();
    ir.tracks[0]!.clips[2]!.durationInFrames = 0;
    expect(validateIR(ir).ok).toBe(false);
  });
  it('6: a clip without a drawing', () => {
    const ir = base();
    beatClipsOf(ir)[2]!.source = '   ';
    expect(validateIR(ir).ok).toBe(false);
  });
  it('9: one id on two clips', () => {
    const ir = base();
    ir.tracks[0]!.clips[1]!.id = ir.tracks[0]!.clips[0]!.id;
    expect(validateIR(ir).ok).toBe(false);
  });
});

describe('videoVars', () => {
  const at = Date.UTC(2026, 7, 22, 6, 30);
  it("gives the video the day and time of the run, in the video's language", () => {
    expect(videoVars({}, 'vi', at)).toMatchObject({ date: expect.stringContaining('2026') });
    expect(videoVars(undefined, 'en-GB', at).date).toBe('22/08/2026');
  });
  it('lets the plan set its own, which then never change', () => {
    const v = videoVars({ date: 'SỐ 12', channel: 'AIDev' }, 'vi', at);
    expect(v.date).toBe('SỐ 12');
    expect(v.channel).toBe('AIDev');
    expect(v.time).toBeTruthy();
  });
});

describe('the clock of a film with no voice (docs/IR_V3.md §5.3)', () => {
  it('is durationSeconds, exactly, with no audio track and no padding to minTotalFrames', () => {
    const ir = buildIR({ plan, params: { durationSeconds: 3, minTotalFrames: 270 } });
    expect(ir.meta.totalDurationInFrames).toBe(90);
    expect(ir.audio).toEqual([]);
    expect(padTailFramesOf(ir)).toBe(0);
    expect(ir.beats.map((b) => b.durationInFrames)).toEqual([22, 45, 23]);
    expect(validateIR(ir)).toEqual({ ok: true, warnings: [] });
  });

  it('is the voice when there is one, whatever durationSeconds says', () => {
    const ir = buildIR({ plan, voiceover, params: { durationSeconds: 3 } });
    expect(ir.meta.totalDurationInFrames).toBe(336);
    expect(ir.audio).toHaveLength(1);
  });

  it('is nothing when neither is there, and says so in a way the person can act on', () => {
    expect(() => buildIR({ plan })).toThrow(NodeError);
    try {
      buildIR({ plan });
    } catch (e) {
      expect((e as NodeError).code).toBe(AssemblerErrorCode.NO_CLOCK);
      expect((e as NodeError).fix).toMatch(/durationSeconds/);
    }
    expect(() => clockOf(undefined, { fps: 30, minTotalFrames: 270, durationSeconds: 0 })).toThrow(NodeError);
  });

  it('leaves captions out of a silent film: lines belong to a voice', () => {
    const captions: CaptionTrack = { cues: [{ start: 0, end: 1, words: [{ text: 'hi', start: 0, end: 1 }] }] };
    const ir = buildIR({ plan, captions, params: { durationSeconds: 3 } });
    expect(ir.captions).toBeUndefined();
    expect(validateIR(ir)).toEqual({ ok: true, warnings: [] });
  });

  it('rounds a fractional duration up to whole frames, never below one', () => {
    expect(clockOf(undefined, { fps: 30, minTotalFrames: 0, durationSeconds: 0.01 })).toEqual({ total: 1, source: 'duration' });
    expect(clockOf(undefined, { fps: 30, minTotalFrames: 0, durationSeconds: 2.5 })).toEqual({ total: 75, source: 'duration' });
    expect(clockOf(voiceover, { fps: 30, minTotalFrames: 400, durationSeconds: 1 })).toEqual({ total: 400, source: 'voice' });
  });
});

describe('layers become tracks around the scenes (docs/IR_V3.md §10 step 4)', () => {
  const CLIP = '/api/assets/' + 'a'.repeat(16) + '.mp4';
  const gameplay: LayerSpec = { kind: 'media', url: CLIP, placement: 'under', startSeconds: 0, offsetSeconds: 12, fit: 'cover', loop: true, gain: 0 };
  const phone: LayerSpec = { kind: 'code', source: '<div class="phone"></div>', placement: 'over', startSeconds: 0 };
  const bug: LayerSpec = { kind: 'media', url: '/api/assets/' + 'b'.repeat(16) + '.png', placement: 'over', startSeconds: 2, durationSeconds: 3, offsetSeconds: 0, fit: 'contain', loop: false, gain: 0 };

  it('stacks under-layers below the scenes and over-layers above, in wire order, numbered across both', () => {
    const ir = buildIR({ plan, voiceover, layers: [phone, gameplay, bug] });
    expect(ir.tracks.map((t) => t.id)).toEqual(['layer-2', 'scenes', 'layer-1', 'layer-3']);
    expect(ir.tracks[0]!.clips[0]).toEqual({ id: 'layer-2-clip', kind: 'media', startFrame: 0, durationInFrames: 336, url: CLIP, offsetSeconds: 12, fit: 'cover', loop: true, gain: 0 });
    expect(ir.tracks[2]!.clips[0]).toMatchObject({ id: 'layer-1-clip', kind: 'code', startFrame: 0, durationInFrames: 336, format: 'html-gsap', source: phone.source });
    // Two seconds in, for three seconds: 60 frames from frame 60.
    expect(ir.tracks[3]!.clips[0]).toMatchObject({ id: 'layer-3-clip', startFrame: 60, durationInFrames: 90 });
    // The beats still describe the scenes alone.
    expect(ir.beats.map((b) => b.clipId)).toEqual(['scene-1', 'scene-2', 'scene-3']);
    expect(validateIR(ir)).toEqual({ ok: true, warnings: [] });
  });

  it('clamps a layer to the film, and refuses one that starts after it', () => {
    const late: LayerSpec = { ...bug, startSeconds: 10, durationSeconds: 100 };
    const ir = buildIR({ plan, voiceover, layers: [late] });
    expect(ir.tracks.at(-1)!.clips[0]).toMatchObject({ startFrame: 300, durationInFrames: 36 });
    expect(() => buildIR({ plan, voiceover, layers: [{ ...bug, startSeconds: 11.2 }] })).toThrow(NodeError);
    try { buildIR({ plan, voiceover, layers: [{ ...bug, startSeconds: 11.2 }] }); } catch (e) { expect((e as NodeError).code).toBe(AssemblerErrorCode.LAYER_OUTSIDE_FILM); }
  });

  it('carries each scene\'s stage onto its beat, for the spanning layers to read', () => {
    const staged: ScenePlan = { ...plan, scenes: plan.scenes.map((s, i) => (i === 1 ? { ...s, stage: { device: { x: 40, y: 400, scale: 1, rot: -6 } } } : s)) };
    const ir = buildIR({ plan: staged, voiceover, layers: [phone] });
    expect(ir.beats[0]!.stage).toBeUndefined();
    expect(ir.beats[1]!.stage).toEqual({ device: { x: 40, y: 400, scale: 1, rot: -6 } });
    expect(validateIR(ir)).toEqual({ ok: true, warnings: [] });
  });

  it('a silent film can still carry layers', () => {
    const ir = buildIR({ plan, layers: [gameplay], params: { durationSeconds: 4 } });
    expect(ir.tracks.map((t) => t.id)).toEqual(['layer-1', 'scenes']);
    expect(ir.tracks[0]!.clips[0]!.durationInFrames).toBe(120);
  });
});

describe('sounds beside the voice become audio tracks (docs/IR_V3.md §5.3)', () => {
  const music: AudioTrackSpec = { url: '/api/media/' + 'd'.repeat(16) + '.mp3', durationSeconds: 184.2, role: 'music', gain: 0.16, startSeconds: 0, loop: true, fadeInSeconds: 1, fadeOutSeconds: 2, duckTo: 0.048 };
  const ambience: AudioTrackSpec = { url: '/api/media/' + 'e'.repeat(16) + '.mp3', durationSeconds: 4, role: 'ambient', gain: 1, startSeconds: 2 };

  it('places each after the voice, named by role and wire order, looped music filling the film and a one-shot ending with its file', () => {
    const ir = buildIR({ plan, voiceover, audio: [music, ambience] });
    expect(ir.audio.map((a) => a.id)).toEqual(['voice', 'music-1', 'ambient-2']);
    expect(ir.audio[1]).toEqual({ id: 'music-1', role: 'music', url: music.url, startFrame: 0, durationInFrames: 336, gain: 0.16, loop: true, fadeInSeconds: 1, fadeOutSeconds: 2, duck: { by: 'voice', to: 0.048 } });
    expect(ir.audio[2]).toEqual({ id: 'ambient-2', role: 'ambient', url: ambience.url, startFrame: 60, durationInFrames: 120, gain: 1 });
    expect(validateIR(ir)).toEqual({ ok: true, warnings: [] });
  });

  it('does not duck under a voice that is not there, and clamps to the film', () => {
    const ir = buildIR({ plan, audio: [music, { ...ambience, startSeconds: 2, playSeconds: 100 }], params: { durationSeconds: 5 } });
    expect(ir.audio.map((a) => a.id)).toEqual(['music-1', 'ambient-2']);
    expect(ir.audio[0]!.duck).toBeUndefined();
    expect(ir.audio[1]).toMatchObject({ startFrame: 60, durationInFrames: 90 });
    expect(validateIR(ir)).toEqual({ ok: true, warnings: [] });
  });

  it('is the clock when nothing else is: the film lasts as long as the longest sound', () => {
    const ir = buildIR({ plan, audio: [{ ...music, loop: false, durationSeconds: 12.5 }, ambience] });
    expect(ir.meta.totalDurationInFrames).toBe(375);
    expect(clockOf(undefined, { fps: 30, minTotalFrames: 270 }, [ambience])).toEqual({ total: 180, source: 'audio' });
    // The parameter outranks the sounds: a long bed under a short film stays under it.
    expect(clockOf(undefined, { fps: 30, minTotalFrames: 270, durationSeconds: 4 }, [music])).toEqual({ total: 120, source: 'duration' });
  });

  it('refuses a sound that starts after the film ends', () => {
    expect(() => buildIR({ plan, voiceover, audio: [{ ...ambience, startSeconds: 12 }] })).toThrow(NodeError);
    try { buildIR({ plan, voiceover, audio: [{ ...ambience, startSeconds: 12 }] }); } catch (e) { expect((e as NodeError).code).toBe(AssemblerErrorCode.AUDIO_OUTSIDE_FILM); }
  });
});

describe('a scene names its format and how it gives way (docs/IR_V3.md §5.4)', () => {
  it('writes the format on the clip and the override at that one boundary, ignoring one on the last scene', () => {
    const named: ScenePlan = {
      ...plan,
      transition: { type: 'wipe-left', seconds: 0.5 },
      scenes: [
        { ...plan.scenes[0]!, format: 'html-gsap', transitionAfter: { type: 'cut', seconds: 0.1 } },
        { ...plan.scenes[1]!, format: 'lottie' },
        { ...plan.scenes[2]!, transitionAfter: { type: 'iris', seconds: 1 } },
      ],
    };
    const ir = buildIR({ plan: named, voiceover });
    expect(beatClipsOf(ir).map((c) => c.format)).toEqual(['html-gsap', 'lottie', 'html-gsap']);
    expect(ir.transitions).toEqual({ default: { name: 'wipe-left', seconds: 0.5 }, at: [{ afterClipId: 'scene-1', name: 'cut', seconds: 0.1 }] });
    expect(validateIR(ir)).toEqual({ ok: true, warnings: [] });
  });
});
