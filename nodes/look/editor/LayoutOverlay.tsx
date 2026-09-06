'use client';
import React from 'react';
import { Rnd } from 'react-rnd';
import type { Box, Frame, MeasuredRect } from '@/core/look/layout-edit';
import { snapBox } from '@/core/look/layout-edit';
import { safeZonesFor } from '@/core/look/safe-zones';

/**
 * Draggable, resizable boxes over the preview, one per top-level element of the stage. Positions
 * are in frame pixels (1080×1920) and drawn scaled; a drop reports the new frame-space box, snapped
 * to the safe-zone lines. The boxes are the app's, outside the sandboxed document.
 */
export const LayoutOverlay: React.FC<{ rects: MeasuredRect[]; scale: number; frame: Frame; selected: string | null; onSelect: (key: string | null) => void; onChange: (key: string, box: Box, resized: boolean) => void }> = ({ rects, scale, frame, selected, onSelect, onChange }) => {
  const zones = safeZonesFor(frame.w, frame.h);
  const toFrame = (x: number, y: number, w: number, h: number): Box => snapBox({ x: x / scale, y: y / scale, w: w / scale, h: h / scale }, frame, zones);
  return (
    <div className="nc-layout" onMouseDown={(e) => { if (e.target === e.currentTarget) onSelect(null); }}>
      {rects.map((r) => (
        <Rnd
          key={r.key}
          className={`nc-layout-box ${selected === r.key ? 'on' : ''}`}
          size={{ width: Math.max(8, r.w * scale), height: Math.max(8, r.h * scale) }}
          position={{ x: r.x * scale, y: r.y * scale }}
          bounds="parent"
          minWidth={8}
          minHeight={8}
          onMouseDown={() => onSelect(r.key)}
          onDragStop={(_e, d) => { const b = toFrame(d.x, d.y, r.w * scale, r.h * scale); if (Math.round(b.x) !== Math.round(r.x) || Math.round(b.y) !== Math.round(r.y)) onChange(r.key, b, false); }}
          onResizeStop={(_e, _dir, el, _delta, pos) => onChange(r.key, toFrame(pos.x, pos.y, el.offsetWidth, el.offsetHeight), true)}
          enableResizing={{ top: true, right: true, bottom: true, left: true, topRight: true, bottomRight: true, bottomLeft: true, topLeft: true }}
        >
          <span className="nc-layout-label">{r.label}</span>
        </Rnd>
      ))}
    </div>
  );
};
