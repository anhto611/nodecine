'use client';
import React from 'react';
import { buildLookPreview, type PreviewOptions } from '@/core/look/markup';
import { safeZonesFor } from '@/core/look/safe-zones';
import type { MeasuredRect } from '@/core/look/layout-edit';

/**
 * A still of a stage or block, drawn by the same markup the engine uses, in a sandboxed iframe with
 * no origin and no network beyond the app's fonts. By default it fills the width it is given and
 * takes the height the aspect ratio dictates (a node card). With `fit` it takes the box it is
 * given, both ways, and draws the largest 9:16 (or whatever the look's ratio is) that fits inside
 * it, centred (a modal). The document is rebuilt when the look changes and not otherwise, so typing
 * in a form does not reload it.
 */
export const LookPreview: React.FC<{ options: PreviewOptions; className?: string; style?: React.CSSProperties; onClick?: () => void; delayMs?: number; fit?: boolean; guides?: boolean; onRects?: (rects: MeasuredRect[]) => void; overlay?: (scale: number) => React.ReactNode }> = ({ options, className, style, onClick, delayMs = 0, fit = false, guides = false, onRects, overlay }) => {
  const width = options.width ?? 1080;
  const height = options.height ?? 1920;
  const ref = React.useRef<HTMLDivElement>(null);
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = React.useState(0.1);
  // Rects come from the preview document itself; only messages from this iframe's window count.
  const onRectsRef = React.useRef(onRects);
  onRectsRef.current = onRects;
  React.useEffect(() => {
    if (!options.measure) return;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      const data = e.data as { type?: string; rects?: MeasuredRect[] };
      if (data?.type === 'nodecine:rects' && Array.isArray(data.rects)) onRectsRef.current?.(data.rects);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [options.measure]);
  const key = JSON.stringify(options);
  const [html, setHtml] = React.useState(() => buildLookPreview(options));
  React.useEffect(() => {
    if (!delayMs) { setHtml(buildLookPreview(options)); return; }
    const t = setTimeout(() => setHtml(buildLookPreview(options)), delayMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, delayMs]);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Width-bound by default; the smaller of the two when the height is a constraint too.
    const measure = () => setScale(Math.max(0.01, fit ? Math.min(el.clientWidth / width, el.clientHeight / height) : el.clientWidth / width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height, fit]);
  const frame = (
    <>
      <iframe ref={frameRef} title="preview" sandbox="allow-scripts" srcDoc={html} style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0, pointerEvents: 'none', background: '#000' }} />
      {guides && <SafeZoneGuides width={width} height={height} />}
      {overlay?.(scale)}
    </>
  );
  if (fit) {
    return (
      <div ref={ref} className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0, minHeight: 0, ...style }} onClick={onClick}>
        <div className="nc-preview" style={{ width: Math.round(width * scale), height: Math.round(height * scale), flex: 'none' }}>{frame}</div>
      </div>
    );
  }
  return (
    <div ref={ref} className={`nc-preview ${className ?? ''}`} style={{ aspectRatio: `${width} / ${height}`, ...style }} onClick={onClick}>
      {frame}
    </div>
  );
};

/**
 * The platform's UI zones over the still, in percentages of the frame so no measuring is needed:
 * hatched where the platform draws, a dashed line around what is left. Drawn by the app, outside
 * the sandboxed document, so it never reaches a render.
 */
export const SafeZoneGuides: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const z = safeZonesFor(width, height);
  const pct = (n: number, of: number) => `${(100 * n) / of}%`;
  const band = (style: React.CSSProperties, label: string, labelStyle: React.CSSProperties) => (
    <div className="nc-guide-band" style={style}><span className="nc-guide-label" style={labelStyle}>{label}</span></div>
  );
  return (
    <div className="nc-guides" aria-hidden>
      {band({ left: 0, top: 0, right: 0, height: pct(z.top, height) }, `${z.top}`, { bottom: 2, left: '50%', transform: 'translateX(-50%)' })}
      {band({ left: 0, bottom: 0, right: 0, height: pct(z.bottom, height) }, `${z.bottom}`, { top: 2, left: '50%', transform: 'translateX(-50%)' })}
      {band({ left: 0, top: pct(z.top, height), bottom: pct(z.bottom, height), width: pct(z.left, width) }, `${z.left}`, { top: '50%', left: 2, transform: 'translateY(-50%)' })}
      {band({ right: 0, top: pct(z.top, height), bottom: pct(z.bottom, height), width: pct(z.right, width) }, `${z.right}`, { top: '50%', right: 2, transform: 'translateY(-50%)' })}
      <div className="nc-guide-safe" style={{ left: pct(z.left, width), right: pct(z.right, width), top: pct(z.top, height), bottom: pct(z.bottom, height) }} />
    </div>
  );
};
