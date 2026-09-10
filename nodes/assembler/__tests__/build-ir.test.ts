import { describe, it, expect } from 'vitest';
import { buildIR, resolveFacts } from '../build-ir';
import { videoVars } from '@/core/visual/vars';
import { validateIR, IRInvalidError } from '@/core/types/validate-ir';
import type { ScenePlan, FactSheet, Voiceover } from '@/core/types/payloads';
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
    expect(ir.irVersion).toBe(2);
    expect(ir.meta.totalDurationInFrames).toBe(336);
    expect(ir.timeline.map((s) => [s.startFrame, s.durationInFrames])).toEqual([
      [0, 84],
      [84, 168],
      [252, 84],
    ]);
    expect(ir.audioTrack.padTailFrames).toBe(0);
    expect(ir.meta.language).toBe('en');
    expect(ir.meta.width).toBe(1080);
    expect(ir.style.name).toBe('Dark');
    expect(ir.transition).toEqual({ type: 'fade', seconds: 0.4 });
    expect(ir.timeline.map((s) => s.id)).toEqual(['scene-1', 'scene-2', 'scene-3']);
    expect(ir.timeline[0]!.source).toBe(SCENE_SOURCE);
    expect(ir.timeline[0]!.facts).toBeUndefined();
    expect(validateIR(ir)).toEqual({ ok: true });
  });

  it('a single scene is valid too', () => {
    const ir = buildIR({ plan: { ...plan, scenes: [plan.scenes[0]!] }, voiceover });
    expect(ir.timeline).toHaveLength(1);
    expect(ir.timeline[0]!.durationInFrames).toBe(336);
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
    expect(ir.timeline[0]!.facts).toEqual({ number: 1284 });
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
  it('5: a scene without a drawing', () => {
    const ir = base();
    ir.timeline[2]!.source = '   ';
    expect(validateIR(ir).ok).toBe(false);
  });
  it('duplicate scene id', () => {
    const ir = base();
    ir.timeline[1]!.id = ir.timeline[0]!.id;
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
