'use client';
import React from 'react';
import { buildLookPreview, type PreviewOptions } from '@/core/look/markup';

/**
 * A still of a stage or block, drawn by the same markup the engine uses, in a sandboxed iframe with
 * no origin and no network beyond the app's fonts, scaled to fit whatever width it is given. The
 * document is rebuilt when the look changes and not otherwise, so typing in a form does not reload it.
 */
export const LookPreview: React.FC<{ options: PreviewOptions; className?: string; style?: React.CSSProperties; onClick?: () => void; delayMs?: number }> = ({ options, className, style, onClick, delayMs = 0 }) => {
  const width = options.width ?? 1080;
  const height = options.height ?? 1920;
  const ref = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.1);
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
    const measure = () => setScale(Math.max(0.01, el.clientWidth / width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className={`nc-preview ${className ?? ''}`} style={{ aspectRatio: `${width} / ${height}`, ...style }} onClick={onClick}>
      <iframe title="preview" sandbox="allow-scripts" srcDoc={html} style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0, pointerEvents: 'none', background: '#000' }} />
    </div>
  );
};
