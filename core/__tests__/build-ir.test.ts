import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { buildIR, applyFactBindings } from '../assembler/build-ir';
import { validateIR, IRInvalidError } from '../assembler/validate-ir';
import { _resetSceneRegistry, registerScene } from '../scenes/registry';
import { registerCoreScenes, TITLE_CARD } from '../scenes/title-card';
import type { DirectorPlan, FactSheet, Voiceover } from '../types/payloads';

const voiceover: Voiceover = {
  audioUrl: '/api/media/0123456789abcdef.mp3',
  durationSeconds: 11.2,
  voiceName: 'Samantha',
  language: 'en',
  speed: 1,
};

const plan: DirectorPlan = {
  language: 'en',
  theme: 'core/dark',
  scenes: [
    { sceneType: TITLE_CARD, weight: 1, props: { headline: 'A' } },
    { sceneType: TITLE_CARD, weight: 2, props: { headline: 'B' } },
    { sceneType: TITLE_CARD, weight: 1, props: { headline: 'C' } },
  ],
};

beforeEach(() => {
  _resetSceneRegistry();
  registerCoreScenes();
});

describe('buildIR', () => {
  it('builds a valid IR matching the docs example', () => {
    const ir = buildIR({ plan, voiceover, params: { title: 't' } });
    expect(ir.meta.totalDurationInFrames).toBe(336);
    expect(ir.timeline.map((s) => [s.startFrame, s.durationInFrames])).toEqual([
      [0, 84],
      [84, 168],
      [252, 84],
    ]);
    expect(ir.audioTrack.padTailFrames).toBe(0);
    expect(ir.meta.language).toBe('en');
    expect(validateIR(ir)).toEqual({ ok: true });
  });

  it('a single scene is valid too', () => {
    const ir = buildIR({ plan: { ...plan, scenes: [plan.scenes[0]!] }, voiceover });
    expect(ir.timeline).toHaveLength(1);
    expect(ir.timeline[0]!.durationInFrames).toBe(336);
  });

  it('invariant 2: facts always win over model-written props', () => {
    registerScene({
      sceneType: 'demo/hook',
      propsSchema: z.object({ headline: z.string(), stars: z.number().nullable().optional() }),
    });
    const facts: FactSheet = {
      facts: { stars: 1284, url: 'github.com/a/b' },
      sourceLabel: 'github.com/a/b',
      fetchedAt: 'x',
      mode: 'fetched',
    };
    const p: DirectorPlan = {
      ...plan,
      scenes: [
        {
          sceneType: 'demo/hook',
          weight: 1,
          props: { headline: 'H', stars: 999999 },
          factBindings: { stars: 'stars', brandName: 'url' },
        },
      ],
    };
    const ir = buildIR({ plan: p, voiceover, facts });
    expect(ir.timeline[0]!.props.stars).toBe(1284);
    expect(ir.timeline[0]!.props.brandName).toBe('github.com/a/b');
  });

  it('without factBindings props are untouched; missing fact keys are ignored', () => {
    expect(applyFactBindings({ a: 1 }, undefined, { a: 2 })).toEqual({ a: 1 });
    expect(applyFactBindings({ a: 1 }, { a: 'missing' }, { b: 2 })).toEqual({ a: 1 });
  });

  it('invariant 5: an unregistered scene type is rejected', () => {
    const p: DirectorPlan = { ...plan, scenes: [{ sceneType: 'nope/x', weight: 1, props: {} }] };
    expect(() => buildIR({ plan: p, voiceover })).toThrow(IRInvalidError);
  });
});

describe('validateIR rejects hand-built IRs that break each invariant', () => {
  const base = () => buildIR({ plan, voiceover });
  it('1: first startFrame ≠ 0', () => {
    const ir = base();
    ir.timeline[0]!.startFrame = 1;
    expect(validateIR(ir)).toMatchObject({ ok: false });
  });
  it('2: gap between scenes', () => {
    const ir = base();
    ir.timeline[1]!.startFrame += 1;
    const r = validateIR(ir);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violations.some((v) => v.startsWith('2:'))).toBe(true);
  });
  it('3: total mismatch', () => {
    const ir = base();
    ir.meta.totalDurationInFrames += 1;
    const r = validateIR(ir);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violations.some((v) => v.startsWith('3:'))).toBe(true);
  });
  it('4: zero-frame scene is blocked by the schema', () => {
    const ir = base();
    ir.timeline[2]!.durationInFrames = 0;
    expect(validateIR(ir).ok).toBe(false);
  });
  it('duplicate scene id', () => {
    const ir = base();
    ir.timeline[1]!.id = ir.timeline[0]!.id;
    expect(validateIR(ir).ok).toBe(false);
  });
});
