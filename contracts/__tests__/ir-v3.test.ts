import { describe, it, expect } from 'vitest';
import { VideoIRV2Schema } from '../types/ir-v2';
import { IR_V3_VERSION, VideoIRV3Schema, allClips, hasTracksUnderBeats, speechWindowsOf, type VideoIRV3 } from '../types/ir-v3';
import { migrateIR, fromV2, readIR, IRVersionUnsupportedError } from '../types/migrate-ir';
import { validateIR, validateIRV2 } from '../types/validate-ir';
import lumenV2 from './fixtures/ir-v2-lumen.json';

/**
 * Version 3 of the IR against a real version-2 film: the Lumen promo, five scenes, twenty caption
 * lines, drawn and spoken by the pipeline on 2026-09-11. The migration has to keep every frame
 * window, every drawing and every word where it was, and the nine invariants have to catch each
 * way a version-3 IR can be wrong.
 */

const v2 = () => structuredClone(lumenV2) as unknown as Parameters<typeof fromV2>[0];
const v3 = (): VideoIRV3 => migrateIR(lumenV2);
const violationsOf = (ir: unknown) => { const r = validateIR(ir); return r.ok ? [] : r.violations; };
const firstCode = (ir: VideoIRV3) => ir.tracks[0]!.clips[0] as Extract<VideoIRV3['tracks'][0]['clips'][0], { kind: 'code' }>;

describe('the fixture', () => {
  it('is a valid version-2 film, so what follows tests the migration and not the sample', () => {
    expect(VideoIRV2Schema.safeParse(lumenV2).success).toBe(true);
    expect(validateIRV2(lumenV2)).toEqual({ ok: true });
  });
});

describe('bringing a version-2 film to version 3', () => {
  it('produces a valid version-3 film', () => {
    const out = v3();
    expect(out.irVersion).toBe(IR_V3_VERSION);
    expect(validateIR(out)).toEqual({ ok: true, warnings: [] });
  });

  it('keeps every scene as a code clip on one track, frame for frame and drawing for drawing', () => {
    const before = v2();
    const after = v3();
    expect(after.tracks).toHaveLength(1);
    expect(after.tracks[0]!.clips).toHaveLength(before.timeline.length);
    before.timeline.forEach((scene, i) => {
      const clip = after.tracks[0]!.clips[i]!;
      expect(clip).toMatchObject({ id: scene.id, kind: 'code', format: 'html-gsap', startFrame: scene.startFrame, durationInFrames: scene.durationInFrames, source: scene.source });
    });
  });

  it('turns the timeline into the beats, contiguous and adding up to the film', () => {
    const before = v2();
    const after = v3();
    expect(after.beats.map((b) => [b.startFrame, b.durationInFrames])).toEqual(before.timeline.map((s) => [s.startFrame, s.durationInFrames]));
    expect(after.beats.map((b) => b.clipId)).toEqual(before.timeline.map((s) => s.id));
    expect(after.beats.reduce((n, b) => n + b.durationInFrames, 0)).toBe(after.meta.totalDurationInFrames);
  });

  it('keeps the voice as the one voice track, never longer than the film', () => {
    const before = v2();
    const after = v3();
    expect(after.audio).toHaveLength(1);
    expect(after.audio[0]).toMatchObject({ role: 'voice', url: before.audioTrack.voiceoverUrl, startFrame: 0, gain: 1 });
    expect(after.audio[0]!.durationInFrames).toBeLessThanOrEqual(after.meta.totalDurationInFrames);
    // padTailFrames has no field of its own; it is what the film has beyond the voice.
    expect(after.meta.totalDurationInFrames - after.audio[0]!.durationInFrames).toBe(before.audioTrack.padTailFrames);
  });

  it('carries the style, the values, the captions and the transition across unchanged', () => {
    const before = v2();
    const after = v3();
    expect(after.style).toEqual(before.style);
    expect(after.vars).toEqual(before.vars);
    expect(after.captions).toEqual(before.captions);
    expect(after.transitions).toEqual({ default: { name: before.transition.type, seconds: before.transition.seconds } });
  });

  it('passes a version-3 film through and refuses a version it does not know', () => {
    const out = v3();
    expect(migrateIR(out)).toEqual(out);
    expect(() => migrateIR({ ...v2(), irVersion: 7 })).toThrow(IRVersionUnsupportedError);
    expect(() => migrateIR({ ...v2(), irVersion: 7 })).toThrow(/version 7/);
    expect(() => migrateIR(null)).toThrow(IRVersionUnsupportedError);
  });

  it('reads a packet for a body: today\'s film for a version-2 or version-3 payload, nothing for anything else', () => {
    expect(readIR(lumenV2)).toEqual(v3());
    expect(readIR(v3())).toEqual(v3());
    expect(readIR(undefined)).toBeUndefined();
    expect(readIR('ir')).toBeUndefined();
    expect(readIR({ irVersion: 1, timeline: [] })).toBeUndefined();
  });
});

describe('what version 3 can say that version 2 could not', () => {
  it('a gameplay loop under every scene, a device that spans the film, and music beside the voice', () => {
    const ir = v3();
    const total = ir.meta.totalDurationInFrames;
    ir.tracks = [
      { id: 'background', clips: [{ id: 'gameplay', kind: 'media', startFrame: 0, durationInFrames: total, url: '/api/assets/' + 'a'.repeat(16) + '.mp4', offsetSeconds: 12, fit: 'cover', loop: true, gain: 0 }] },
      ir.tracks[0]!,
      { id: 'device', clips: [{ id: 'phone', kind: 'code', startFrame: 0, durationInFrames: total, format: 'html-gsap', source: '<div class="phone"></div>' }] },
    ];
    ir.beats = ir.beats.map((b, i) => ({ ...b, stage: { device: { x: i * 40, y: 400, scale: 1, rot: -6 + i } } }));
    ir.audio.push({ id: 'music', role: 'music', url: '/api/media/' + 'b'.repeat(16) + '.mp3', startFrame: 0, durationInFrames: total, gain: 0.2, duck: { by: 'voice', to: 0.06 } });
    ir.transitions.at = [{ afterClipId: ir.beats[1]!.clipId, name: 'css-push-left', seconds: 0.5 }];
    expect(VideoIRV3Schema.safeParse(ir).success).toBe(true);
    expect(validateIR(ir)).toEqual({ ok: true, warnings: [] });
    expect(allClips(ir)).toHaveLength(7);
  });

  it('a silent film: no audio, no captions, the clock its own', () => {
    const ir = v3();
    ir.audio = [];
    delete ir.captions;
    expect(validateIR(ir)).toEqual({ ok: true, warnings: [] });
  });

  it('an empty track is legal and pointless, so it warns', () => {
    const ir = v3();
    ir.tracks.push({ id: 'spare', clips: [] });
    expect(validateIR(ir)).toEqual({ ok: true, warnings: ['track "spare" is empty'] });
  });
});

describe('the nine invariants', () => {
  it('1: a film with no clip at all', () => {
    const ir = v3();
    ir.tracks = [{ id: 'empty', clips: [] }];
    expect(violationsOf(ir).some((m) => m.startsWith('1:'))).toBe(true);
  });

  it('2: clips on one track out of order, or overlapping', () => {
    const shuffled = v3();
    shuffled.tracks[0]!.clips.reverse();
    expect(violationsOf(shuffled).some((m) => m.startsWith('2:') && /starts before/.test(m))).toBe(true);

    const overlapping = v3();
    overlapping.tracks[0]!.clips[1]!.startFrame -= 10;
    expect(violationsOf(overlapping).some((m) => m.startsWith('2:') && /overlap/.test(m))).toBe(true);
  });

  it('3: a clip or an audio track that outlasts the film', () => {
    const clip = v3();
    clip.tracks[0]!.clips.at(-1)!.durationInFrames += 1;
    expect(violationsOf(clip).some((m) => m.startsWith('3: clip'))).toBe(true);

    const audio = v3();
    audio.audio[0]!.durationInFrames = audio.meta.totalDurationInFrames + 1;
    expect(violationsOf(audio).some((m) => m.startsWith('3: audio'))).toBe(true);
  });

  it('4: beats that do not start at zero, leave a gap, or do not add up', () => {
    const late = v3();
    late.beats[0]!.startFrame = 1;
    expect(violationsOf(late).some((m) => m.startsWith('4: beats[0]'))).toBe(true);

    const gap = v3();
    gap.beats[2]!.startFrame += 5;
    expect(violationsOf(gap).some((m) => m.startsWith('4: beat 2'))).toBe(true);

    const short = v3();
    short.beats.at(-1)!.durationInFrames -= 1;
    expect(violationsOf(short).some((m) => /^4: beats sum/.test(m))).toBe(true);
  });

  it('5: a beat that names a missing clip, a media clip, or runs outside its clip', () => {
    const missing = v3();
    missing.beats[0]!.clipId = 'nowhere';
    expect(violationsOf(missing).some((m) => m.startsWith('5:') && /does not exist/.test(m))).toBe(true);

    const media = v3();
    media.tracks.push({ id: 'bg', clips: [{ id: 'clipfile', kind: 'media', startFrame: 0, durationInFrames: media.meta.totalDurationInFrames, url: '/api/media/' + 'c'.repeat(16) + '.mp4', offsetSeconds: 0, fit: 'cover', loop: false, gain: 0 }] });
    media.beats[0]!.clipId = 'clipfile';
    expect(violationsOf(media).some((m) => m.startsWith('5:') && /media clip/.test(m))).toBe(true);

    const outside = v3();
    outside.tracks[0]!.clips[0]!.durationInFrames -= 1;
    outside.tracks[0]!.clips[1]!.startFrame -= 1;
    outside.tracks[0]!.clips[1]!.durationInFrames += 1;
    expect(violationsOf(outside).some((m) => m.startsWith('5:') && /outside its clip/.test(m))).toBe(true);
  });

  it('6: a code clip that is blank, or a whole page', () => {
    const blank = v3();
    firstCode(blank).source = '   ';
    expect(violationsOf(blank).some((m) => m.startsWith('6:') && /no drawing/.test(m))).toBe(true);

    const page = v3();
    firstCode(page).source = '<html><body>hi</body></html>';
    expect(violationsOf(page).some((m) => m.startsWith('6:') && /whole page/.test(m))).toBe(true);
  });

  it('7: two voices, or captions with no voice to belong to', () => {
    const two = v3();
    two.audio.push({ ...two.audio[0]!, id: 'voice-2' });
    expect(violationsOf(two).some((m) => m.startsWith('7:') && /voice tracks/.test(m))).toBe(true);

    const orphan = v3();
    orphan.audio = [];
    expect(violationsOf(orphan).some((m) => m.startsWith('7:') && /captions without a voice/.test(m))).toBe(true);
  });

  it('8: ducking by a track that is not there, or a transition after a clip that is not a beat', () => {
    const duck = v3();
    duck.audio.push({ id: 'music', role: 'music', url: '/api/media/' + 'd'.repeat(16) + '.mp3', startFrame: 0, durationInFrames: 30, gain: 0.3, duck: { by: 'ghost', to: 0.1 } });
    expect(violationsOf(duck).some((m) => m.startsWith('8:') && /ducks by "ghost"/.test(m))).toBe(true);

    const self = v3();
    self.audio[0]!.duck = { by: 'voice', to: 0.1 };
    expect(violationsOf(self).some((m) => m.startsWith('8:') && /by itself/.test(m))).toBe(true);

    const transition = v3();
    transition.transitions.at = [{ afterClipId: 'nowhere', name: 'fade', seconds: 0.3 }];
    expect(violationsOf(transition).some((m) => m.startsWith('8:') && /not a beat clip/.test(m))).toBe(true);
  });

  it('9: one id used for two things', () => {
    const ir = v3();
    ir.audio[0]!.id = ir.tracks[0]!.id;
    expect(violationsOf(ir).some((m) => m.startsWith('9:'))).toBe(true);
  });
});

describe('when the voice speaks, for a track that ducks under it', () => {
  it('is the caption lines merged across short gaps, the whole voice without captions, nothing without a voice', () => {
    const ir = v3();
    const windows = speechWindowsOf(ir);
    expect(windows.length).toBeGreaterThan(0);
    expect(windows.length).toBeLessThanOrEqual(ir.captions!.cues.length);
    for (let i = 1; i < windows.length; i++) expect(windows[i]!.startFrame - windows[i - 1]!.endFrame).toBeGreaterThan(10);
    delete ir.captions;
    expect(speechWindowsOf(ir)).toEqual([{ startFrame: 0, endFrame: ir.audio[0]!.durationInFrames }]);
    ir.audio = [];
    expect(speechWindowsOf(ir)).toEqual([]);
  });
});

describe('what lies under the scenes', () => {
  it('is nothing for a one-track film, a layer placed under, never a layer placed over or an empty track', () => {
    const ir = v3();
    expect(hasTracksUnderBeats(ir)).toBe(false);
    const total = ir.meta.totalDurationInFrames;
    const media = { id: 'bg', kind: 'media' as const, startFrame: 0, durationInFrames: total, url: '/api/assets/' + 'a'.repeat(16) + '.mp4', offsetSeconds: 0, fit: 'cover' as const, loop: true, gain: 0 };
    expect(hasTracksUnderBeats({ ...ir, tracks: [{ id: 'under', clips: [media] }, ...ir.tracks] })).toBe(true);
    expect(hasTracksUnderBeats({ ...ir, tracks: [...ir.tracks, { id: 'over', clips: [media] }] })).toBe(false);
    expect(hasTracksUnderBeats({ ...ir, tracks: [{ id: 'empty', clips: [] }, ...ir.tracks] })).toBe(false);
  });
});
