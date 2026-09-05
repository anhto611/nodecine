import { describe, expect, it } from 'vitest';
import { clampCentre, frameFor, viewRect, type Extent } from '../minimap-geometry';

const MAX = { w: 172, h: 108 };
/** A 16:9 pannable area, the shape the canvas always gives it. */
const extent: Extent = [
  [-1000, -500],
  [2200, 1300],
];

describe('frameFor', () => {
  it('keeps the extent proportions and fits inside the maximum box', () => {
    const f = frameFor(extent, MAX);
    expect(f.w).toBeLessThanOrEqual(MAX.w + 1e-9);
    expect(f.h).toBeLessThanOrEqual(MAX.h + 1e-9);
    expect(f.w / f.h).toBeCloseTo(16 / 9, 10);
    expect(Math.max(f.w, f.h)).toBeCloseTo(172, 10);
  });

  it('maps the extent onto the frame exactly, with no letterboxing', () => {
    const f = frameFor(extent, MAX);
    expect((2200 - -1000) / f.scale).toBeCloseTo(f.w, 10);
    expect((1300 - -500) / f.scale).toBeCloseTo(f.h, 10);
  });

  it('handles a degenerate extent without dividing by zero', () => {
    const f = frameFor([[0, 0], [0, 0]], MAX);
    expect(Number.isFinite(f.w) && Number.isFinite(f.h) && f.scale > 0).toBe(true);
  });
});

describe('clampCentre', () => {
  const inside = (c: { x: number; y: number }, view: { w: number; h: number }) =>
    c.x - view.w / 2 >= -1000 - 1e-9 && c.x + view.w / 2 <= 2200 + 1e-9 && c.y - view.h / 2 >= -500 - 1e-9 && c.y + view.h / 2 <= 1300 + 1e-9;

  it('leaves a centre that already fits untouched', () => {
    const view = { w: 400, h: 225 };
    expect(clampCentre(600, 400, view, extent)).toEqual({ x: 600, y: 400 });
  });

  it('pulls the viewport back so it never leaves the extent', () => {
    const view = { w: 400, h: 225 };
    for (const [cx, cy] of [[-99999, -99999], [99999, 99999], [-1000, 1300], [2200, -500]] as [number, number][]) {
      const c = clampCentre(cx, cy, view, extent);
      expect(inside(c, view)).toBe(true);
    }
  });

  it('centres an axis where the viewport is larger than the extent', () => {
    // This is the zoomed-all-the-way-out case: the screen covers more than the pannable area.
    const view = { w: 9000, h: 200 };
    const c = clampCentre(-99999, 0, view, extent);
    expect(c.x).toBeCloseTo((-1000 + 2200) / 2, 10);
    expect(c.y).toBeCloseTo(0, 10);
  });

  it('keeps the viewport inside while zooming out from a corner', () => {
    // The bug: parked at a corner at high zoom, then zoomed out, the rectangle slid out of the frame.
    let centre = clampCentre(-99999, -99999, { w: 300, h: 169 }, extent);
    for (let zoom = 2; zoom >= 0.3; zoom /= 1.4) {
      const view = { w: 1396 / zoom, h: 785 / zoom };
      centre = clampCentre(centre.x, centre.y, view, extent);
      expect(inside(centre, view) || view.w > 3200 || view.h > 1800).toBe(true);
    }
  });
});

describe('viewRect', () => {
  it('converts a canvas transform into the visible flow rect', () => {
    expect(viewRect([-200, -100, 2], { w: 1400, h: 700 })).toEqual({ x: 100, y: 50, w: 700, h: 350 });
  });

  it('keeps the proportions of the canvas at any zoom', () => {
    const pane = { w: 1396, h: 572 };
    for (const zoom of [0.3, 0.66, 1, 2]) {
      const r = viewRect([-13, 47, zoom], pane);
      expect(r.w / r.h).toBeCloseTo(pane.w / pane.h, 10);
    }
  });
});
