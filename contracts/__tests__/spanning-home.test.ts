import { describe, expect, it } from 'vitest';
import { buildSpanningPrompt, spanningLane } from '../visual/spanning';
import { safeZonesFor } from '../visual/safe-zones';
import { STYLE } from './scene-fixtures';
import type { LayerSpec, SceneScript, StyleSheet } from '../types/payloads';

/**
 * Where a thing that spans the film lives, and what the scenes may therefore do with the rest.
 *
 * A layout is drawn once and poured into many times, so it cannot know where a travelling thing
 * will be in any one scene — it can only avoid everywhere that thing might go. On a portrait frame
 * that is the whole safe area, and a model told to avoid all of it puts the words below the safe
 * area, on top of the captions. A declared home turns an impossible instruction into a small one.
 */

const frame = { width: 1080, height: 1920 };
const sheet: StyleSheet = { style: STYLE, guide: 'g', frame, transparent: false };
const script: SceneScript = { language: 'vi', scenes: [{ role: 'a', weight: 1, narration: 'n', content: { title: 't' } }] };
const HOME = { x: 240, y: 580, width: 600, height: 640 };
const phone = (home?: typeof HOME): LayerSpec => ({ kind: 'code', id: 'phone', brief: 'một chiếc điện thoại', placement: 'over', source: '<div></div>', startSeconds: 0, width: 300, height: 620, ...(home ? { home } : {}) });

describe('what a spanning drawing is told about its own home', () => {
  const brief = { brief: 'một chiếc điện thoại', style: STYLE, guide: 'g', frame, placement: 'over' as const, beats: 4 };

  it('is the rectangle and the promise never to leave it', () => {
    const p = buildSpanningPrompt({ ...brief, home: HOME });
    expect(p).toContain('600×640 px rectangle whose top-left corner is at 240,580');
    expect(p).toContain('never move a pixel outside that rectangle');
  });

  it('falls back to the lane above the captions when the film gave it none', () => {
    const p = buildSpanningPrompt(brief);
    expect(p).toContain(`It has to fit in ${spanningLane(frame).width}×${spanningLane(frame).height} px`);
  });
});
