import { describe, it, expect } from 'vitest';
import { segmentsOf } from '../video-sample';
import { describeSample, sampleStats, type SampleProfile } from '@/contracts/agent/sample';
import { applyAgentActions } from '@/contracts/agent/actions';
import { ensureServerRegistrations } from '../register';
import type { Graph } from '@/core/engine/graph';

/** A sample video, read: where it changes, how the agent is told about it, and starting over from a template. */

const breakdown = (shots: { start: number; end: number; beats?: number[] }[], duration: number) => ({ source: { width: 1080, height: 1920, fps: 30, duration }, shots });

describe('the segments of a sample', () => {
  it('are the shots, cut again at the beats inside them', () => {
    const segs = segmentsOf(breakdown([{ start: 0, end: 30, beats: [1.5, 4.1, 9.067] }], 30));
    expect(segs.map((s) => [s.start, s.end, s.by])).toEqual([
      [0, 1.5, 'start'],
      [1.5, 4.1, 'beat'],
      [4.1, 9.07, 'beat'],
      [9.07, 30, 'beat'],
    ]);
  });

  it('count a new shot as a cut and drop a beat too close to an edge', () => {
    const segs = segmentsOf(
      breakdown(
        [
          { start: 0, end: 10, beats: [0.2, 5] },
          { start: 10, end: 20, beats: [19.8] },
        ],
        20,
      ),
    );
    expect(segs.map((s) => [s.start, s.by])).toEqual([
      [0, 'start'],
      [5, 'beat'],
      [10, 'cut'],
    ]);
  });
});

describe('a sample as the agent reads it', () => {
  const p: SampleProfile = {
    id: '0123456789abcdef',
    name: 'promo.mp4',
    durationSeconds: 30,
    width: 1080,
    height: 1920,
    fps: 30,
    segments: [
      { start: 0, end: 10, by: 'start' },
      { start: 10, end: 20, by: 'beat' },
      { start: 20, end: 30, by: 'cut' },
    ],
    frames: [],
    made: 'screen recording 100%',
    captions: ['32 subtitle lines; type-on×4'],
    audio: { present: true, music: 'music under 80% of it', musicBpm: 120 },
    speech: { language: 'en', lines: [{ start: 0, end: 2, text: 'Hello there.' }] },
  };

  it('gives the shape, the pace, the sound and what was said', () => {
    expect(sampleStats(p)).toMatchObject({ orientation: 'portrait', segments: 3, medianSegmentSeconds: 10, changesPerMinute: 4 });
    const text = describeSample(p);
    expect(text).toContain('1080×1920 (portrait)');
    expect(text).toContain('20–30 (cut)');
    expect(text).toContain('type-on×4');
    expect(text).toContain('120 BPM');
    expect(text).toContain('0–2 s: Hello there.');
  });
});

describe('starting over from a template', () => {
  it('takes the template nodes and keeps the workflow model', () => {
    ensureServerRegistrations();
    const current: Graph = {
      nodes: [{ id: 'old', type: 'brief', params: { about: '', hint: {} }, bypassed: false, position: { x: 0, y: 0 } }],
      edges: [],
      settings: { llm: { provider: 'agy', settings: {} } },
    };
    const template: Graph = { nodes: [{ id: 'brief', type: 'brief', params: { about: '', hint: {} }, bypassed: false, position: { x: 0, y: 0 } }], edges: [], settings: { other: 1 } };
    const r = applyAgentActions(current, [
      { op: 'useTemplate', id: 't', graph: template },
      { op: 'set', node: 'brief', params: { about: 'tea' } },
    ]);
    expect(r.results.map((x) => x.ok)).toEqual([true, true]);
    expect(r.graph.nodes.map((n) => [n.id, n.params.about])).toEqual([['brief', 'tea']]);
    expect(r.graph.settings).toEqual({ other: 1, llm: { provider: 'agy', settings: {} } });
    expect(applyAgentActions(current, [{ op: 'useTemplate', id: 'missing' }]).results[0]!.ok).toBe(false);
  });
});
