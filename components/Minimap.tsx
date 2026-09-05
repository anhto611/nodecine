'use client';
import React from 'react';
import { useReactFlow, useStore } from '@xyflow/react';
import type { NodeRuntime } from '@/core/engine/state';

/**
 * Minimap with a FIXED frame (USER_FLOWS §1.1).
 *
 * React Flow's own MiniMap fits itself to the union of the node bounds and the current viewport, so
 * panning rescales the whole map and the viewport rectangle appears to stretch even though the canvas
 * zoom never changed. Here the frame is the pan extent, which only changes when nodes move, so the
 * rectangle moves as you pan and resizes only as you zoom — the behaviour a node editor is expected
 * to have.
 */

export type Extent = [[number, number], [number, number]];

type Tone = 'idle' | 'run' | 'ok' | 'warn' | 'err';

const TONE: Record<Tone, string> = {
  idle: '#4a5060',
  run: '#58a6ff',
  ok: '#3fb950',
  warn: '#d29922',
  err: '#f85149',
};

/** The frame takes the aspect ratio of the pan extent and fits inside this box. */
const MAX_WIDTH = 172;
const MAX_HEIGHT = 108;

const toneOf = (state: string | undefined): Tone =>
  state === 'running' ? 'run' : state === 'success' ? 'ok' : state === 'error' ? 'err' : state === 'blocked' ? 'warn' : 'idle';

export const Minimap: React.FC<{
  extent: Extent;
  nodes: { id: string; position: { x: number; y: number } }[];
  sizes: Record<string, { w: number; h: number }>;
  runtimes: Record<string, NodeRuntime>;
  minZoom: number;
  maxZoom: number;
}> = ({ extent, nodes, sizes, runtimes, minZoom, maxZoom }) => {
  const rf = useReactFlow();
  const transform = useStore((s) => s.transform);
  const paneWidth = useStore((s) => s.width);
  const paneHeight = useStore((s) => s.height);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const drag = React.useRef<{ x: number; y: number } | null>(null);
  /**
   * setViewport reaches the store a frame later, so getViewport still reports the old value while a
   * wheel burst is being delivered. Keep what we last wrote and continue from it until the store
   * catches up, otherwise every event in a burst but one is a no-op and zooming feels stuck.
   */
  const pending = React.useRef<{ x: number; y: number; zoom: number } | null>(null);

  const [[ex, ey], [ex2, ey2]] = extent;
  const ew = Math.max(1, ex2 - ex);
  const eh = Math.max(1, ey2 - ey);

  // The frame mirrors the shape of the pannable area instead of letterboxing it, so the extent fills
  // the frame edge to edge and the viewport rectangle can be dragged against all four sides.
  const scale = Math.max(ew / MAX_WIDTH, eh / MAX_HEIGHT);
  const WIDTH = ew / scale;
  const HEIGHT = eh / scale;
  const originX = ex;
  const originY = ey;

  React.useEffect(() => {
    pending.current = null;
  }, [transform]);
  const live = () => pending.current ?? rf.getViewport();
  const write = (v: { x: number; y: number; zoom: number }) => {
    pending.current = v;
    rf.setViewport(v);
  };

  const [tx, ty, zoom] = transform;
  const view = { x: -tx / zoom, y: -ty / zoom, w: paneWidth / zoom, h: paneHeight / zoom };

  const toPx = (fx: number, fy: number) => ({ x: (fx - originX) / scale, y: (fy - originY) / scale });
  /**
   * The viewport drawn inside the frame. At the lowest zoom the visible area is wider than the whole
   * pannable extent, so the rectangle is clipped to the frame and inset by half its stroke: without
   * that, the left and right edges of the outline are cut off by the frame and it reads as unbordered.
   */
  const half = 0.5;
  const raw = { x: toPx(view.x, view.y).x, y: toPx(view.x, view.y).y, w: view.w / scale, h: view.h / scale };
  const vx0 = Math.max(half, raw.x);
  const vy0 = Math.max(half, raw.y);
  const vx1 = Math.min(WIDTH - half, raw.x + raw.w);
  const vy1 = Math.min(HEIGHT - half, raw.y + raw.h);
  const viewRect = { x: vx0, y: vy0, w: Math.max(2, vx1 - vx0), h: Math.max(2, vy1 - vy0) };

  /**
   * Move the canvas so the given minimap point becomes the centre of the viewport, clamped to the
   * same extent the canvas itself pans within — setViewport writes the transform directly and does
   * not go through React Flow's translateExtent.
   */
  const centreOn = (clientX: number, clientY: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const cur = live();
    const vw = paneWidth / cur.zoom;
    const vh = paneHeight / cur.zoom;
    const clamp = (c: number, half: number, lo: number, hi: number) =>
      hi - lo < half * 2 ? (lo + hi) / 2 : Math.min(Math.max(c, lo + half), hi - half);
    const fx = clamp(originX + ((clientX - r.left) / r.width) * WIDTH * scale, vw / 2, ex, ex2);
    const fy = clamp(originY + ((clientY - r.top) / r.height) * HEIGHT * scale, vh / 2, ey, ey2);
    write({ x: -fx * cur.zoom + paneWidth / 2, y: -fy * cur.zoom + paneHeight / 2, zoom: cur.zoom });
  };

  /**
   * Wheel over the map zooms the canvas about its centre; the frame itself never rescales.
   * Reads the live viewport rather than the render closure: a fast wheel burst delivers several
   * events within one frame, and a stale zoom would make all but the last one a no-op.
   */
  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const cur = live();
    const next = Math.min(maxZoom, Math.max(minZoom, cur.zoom * Math.pow(2, -e.deltaY / 400)));
    if (next === cur.zoom) return;
    const cx = -cur.x / cur.zoom + paneWidth / cur.zoom / 2;
    const cy = -cur.y / cur.zoom + paneHeight / cur.zoom / 2;
    write({ x: -cx * next + paneWidth / 2, y: -cy * next + paneHeight / 2, zoom: next });
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
    centreOn(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    centreOn(e.clientX, e.clientY);
  };
  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <svg
      ref={svgRef}
      className="nc-minimap nodrag nopan nowheel"
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ width: WIDTH, height: HEIGHT }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={onWheel}
    >
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="rgba(4,5,7,.78)" />
      {nodes.map((n) => {
        const p = toPx(n.position.x, n.position.y);
        const s = sizes[n.id] ?? { w: 196, h: 150 };
        return (
          <rect
            key={n.id}
            x={p.x}
            y={p.y}
            width={Math.max(1.5, s.w / scale)}
            height={Math.max(1.5, s.h / scale)}
            rx={1}
            fill={TONE[toneOf(runtimes[n.id]?.state)]}
            opacity={0.9}
          />
        );
      })}
      {/* The viewport: a bright hole punched over the dimmed map, rounded like the frame around it. */}
      <rect x={viewRect.x} y={viewRect.y} width={viewRect.w} height={viewRect.h} rx={3} fill="rgba(124,92,255,.14)" stroke="#7c5cff" strokeWidth={1} />
    </svg>
  );
};

