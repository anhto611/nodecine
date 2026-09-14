'use client';
import React from 'react';
import { previewEngine } from '@/contracts/adapters/registry';
import type { ScenePreviewOptions } from '@/contracts/adapters/types';
import { safeZonesFor } from '@/contracts/visual/safe-zones';

/**
 * gsap's source, fetched once for the whole app.
 *
 * A still is enough for a scene, whose markup carries its own words. It is not enough for a drawing
 * that spans the film: those are written to be placed and revealed by their own script, so a still
 * of one is an empty frame. `animate` runs the script in the sandbox, which needs gsap inlined.
 */
let gsapSource: Promise<string> | null = null;
const loadGsap = (): Promise<string> => {
  gsapSource ??= fetch('/api/vendor/gsap.js')
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`vendor gsap: ${r.status}`))))
    .catch(() => { gsapSource = null; return ''; });
  return gsapSource;
};

/**
 * A still of one scene, drawn by the engine that can (`previewScene` on its adapter), in a
 * sandboxed iframe with no origin and no network beyond the app's fonts. No engine registered
 * that draws stills: an empty frame. By default it fills the width it is given and takes
 * the height the aspect ratio dictates (a node card). With `fit` it takes the box it is given, both
 * ways, and draws the largest frame of the scene's ratio that fits inside it, centred (a modal). The
 * document is rebuilt when the scene changes and not otherwise.
 */
export const ScenePreview: React.FC<{ options: ScenePreviewOptions; className?: string; style?: React.CSSProperties; onClick?: () => void; delayMs?: number; fit?: boolean; guides?: boolean; lazy?: boolean; animate?: boolean }> = ({ options, className, style, onClick, delayMs, fit, guides, lazy, animate }) => {
  const width = options.width ?? 1080;
  const height = options.height ?? 1920;
  const ref = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.1);
  const key = JSON.stringify(options);
  // Empty until gsap arrives; the document is built again when it does.
  const [gsap, setGsap] = React.useState('');
  React.useEffect(() => {
    if (!animate || gsap) return;
    let alive = true;
    void loadGsap().then((src) => { if (alive) setGsap(src); });
    return () => { alive = false; };
  }, [animate, gsap]);
  const build = (o: ScenePreviewOptions) => previewEngine()?.previewScene?.({ ...o, ...(animate && gsap ? { animate: { gsapSource: gsap } } : {}) }) ?? '';
  /**
   * `lazy` holds the document back until the frame has been scrolled near. Each of these is a whole
   * page with the film's style sheet in it, so a grid that mounts every one at once costs a browser
   * far more than the few the person can actually see. Once seen it stays built: scrolling back up
   * a list that rebuilds itself flickers.
   */
  const [seen, setSeen] = React.useState(!lazy);
  React.useEffect(() => {
    const el = ref.current;
    if (seen || !el || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setSeen(true); }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  const [html, setHtml] = React.useState(() => (lazy ? '' : build(options)));
  React.useEffect(() => {
    if (!seen) return;
    if (!delayMs) { setHtml(build(options)); return; }
    const t = setTimeout(() => setHtml(build(options)), delayMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, delayMs, seen, gsap]);
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
