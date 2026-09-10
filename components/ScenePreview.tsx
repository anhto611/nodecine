'use client';
import React from 'react';
import { buildScenePreview, type PreviewOptions } from '@/core/visual/markup';
import { safeZonesFor } from '@/core/visual/safe-zones';

/**
 * A still of one scene, drawn by the same markup the engine uses, in a sandboxed iframe with no
 * origin and no network beyond the app's fonts. By default it fills the width it is given and takes
 * the height the aspect ratio dictates (a node card). With `fit` it takes the box it is given, both
 * ways, and draws the largest frame of the scene's ratio that fits inside it, centred (a modal). The
 * document is rebuilt when the scene changes and not otherwise.
 */
export const ScenePreview: React.FC<{ options: PreviewOptions; className?: string; style?: React.CSSProperties; onClick?: () => void; delayMs?: number; fit?: boolean; guides?: boolean }> = ({ options, className, style, onClick, delayMs, fit, guides }) => {
  const width = options.width ?? 1080;
  const height = options.height ?? 1920;
  const ref = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.1);
  const key = JSON.stringify(options);
  const [html, setHtml] = React.useState(() => buildScenePreview(options));
  React.useEffect(() => {
    if (!delayMs) { setHtml(buildScenePreview(options)); return; }
    const t = setTimeout(() => setHtml(buildScenePreview(options)), delayMs);
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
      <iframe title="preview" sandbox="allow-scripts" srcDoc={html} style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0, pointerEvents: 'none', display: 'block' }} />
      {guides && <SafeZoneGuides width={width} height={height} />}
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
