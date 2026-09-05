/**
 * Pure geometry behind the minimap (USER_FLOWS §1.1). Kept out of the component because every bug
 * this area has produced was a geometry bug: a frame that changed shape, a viewport rectangle that
 * was squashed to fit, and one that slid out of the frame when zoomed from a corner.
 */

export type Extent = [[number, number], [number, number]];
export type Rect = { x: number; y: number; w: number; h: number };

/**
 * The frame that draws `extent`, as large as fits in `max` while keeping the extent's proportions.
 * The frame is the extent, so the two always have the same shape and the extent fills it exactly.
 */
export function frameFor(extent: Extent, max: { w: number; h: number }): { w: number; h: number; scale: number } {
  const [[x0, y0], [x1, y1]] = extent;
  const ew = Math.max(1, x1 - x0);
  const eh = Math.max(1, y1 - y0);
  const scale = Math.max(ew / max.w, eh / max.h);
  return { w: ew / scale, h: eh / scale, scale };
}

/**
 * Where the centre of the viewport may sit so that the whole visible rect stays inside the extent.
 * A viewport larger than the extent on an axis is centred on that axis instead of clamped.
 */
export function clampCentre(cx: number, cy: number, view: { w: number; h: number }, extent: Extent): { x: number; y: number } {
  const [[x0, y0], [x1, y1]] = extent;
  const axis = (c: number, half: number, lo: number, hi: number) =>
    hi - lo < half * 2 ? (lo + hi) / 2 : Math.min(Math.max(c, lo + half), hi - half);
  return { x: axis(cx, view.w / 2, x0, x1), y: axis(cy, view.h / 2, y0, y1) };
}

/** The visible flow rect for a canvas transform. */
export function viewRect(transform: [number, number, number], pane: { w: number; h: number }): Rect {
  const [tx, ty, zoom] = transform;
  return { x: -tx / zoom, y: -ty / zoom, w: pane.w / zoom, h: pane.h / zoom };
}
