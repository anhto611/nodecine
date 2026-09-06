'use client';
import React from 'react';
import type { BlockDef, StageDef } from '@/core/types/payloads';
import { useT } from '@/components/ui';
import { LookPreview } from '@/nodes/art-director/preview';
import type { MeasuredRect } from '@/core/look/layout-edit';
import { LayoutOverlay } from './LayoutOverlay';

const GUIDES_KEY = 'nodecine.previewGuides';
const MOTION_KEY = 'nodecine.previewMotion';
export const PANE_STRIP = 34;
export const PANE_INSET = 12;

function useRemembered(key: string, fallback: boolean): [boolean, () => void] {
  const [v, setV] = React.useState<boolean>(() => { try { const s = localStorage.getItem(key); return s === null ? fallback : s === '1'; } catch { return fallback; } });
  const toggle = () => setV((x) => { try { localStorage.setItem(key, x ? '0' : '1'); } catch { /* private mode */ } return !x; });
  return [v, toggle];
}

/**
 * The right half of the modal: the still (or the looping motion) of the draft at the workflow's
 * frame, with the safe-zone guides, the tone picker, and — in layout mode — the drag boxes. The
 * pane is exactly as wide as a frame of its height needs, capped at half the modal.
 */
export const PreviewPane: React.FC<{
  stage: StageDef;
  block?: BlockDef;
  frame: { width: number; height: number };
  layout: boolean;
  rects: MeasuredRect[];
  onRects: (r: MeasuredRect[]) => void;
  selected: string | null;
  onSelect: (key: string | null) => void;
  onBox: (key: string, box: { x: number; y: number; w: number; h: number }, resized: boolean) => void;
  resetKey: string;
}> = ({ stage, block, frame, layout, rects, onRects, selected, onSelect, onBox, resetKey }) => {
  const t = useT();
  const [guides, toggleGuides] = useRemembered(GUIDES_KEY, true);
  const [motion, toggleMotion] = useRemembered(MOTION_KEY, false);
  const [tone, setTone] = React.useState('');
  React.useEffect(() => { setTone(''); }, [resetKey]);
  // Motion needs gsap's source, fetched once and inlined into the preview document.
  const [gsap, setGsap] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!motion || gsap) return;
    let alive = true;
    void import('@/engines/hyperframes/player.client').then((m) => m.gsapSource()).then((s) => { if (alive) setGsap(s); }).catch(() => undefined);
    return () => { alive = false; };
  }, [motion, gsap]);
  const animate = motion && !layout && gsap ? { gsapSource: gsap } : undefined;

  const paneRef = React.useRef<HTMLDivElement>(null);
  const [paneWidth, setPaneWidth] = React.useState<number>(360);
  React.useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const ratio = frame.width / frame.height;
    const measure = () => {
      const byHeight = (el.clientHeight - PANE_STRIP - 2 * PANE_INSET) * ratio + 2 * PANE_INSET;
      const max = (el.parentElement?.clientWidth ?? 1200) * 0.5;
      setPaneWidth(Math.round(Math.min(byHeight, max)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [frame.width, frame.height, resetKey]);

  const tones = Object.keys(stage.tones);
  const FRAME = { w: frame.width, h: frame.height };
  return (
    <div ref={paneRef} style={{ width: paneWidth, flex: 'none', display: 'flex', flexDirection: 'column', background: 'var(--bg-sunk)', minHeight: 0 }}>
      <div style={{ height: PANE_STRIP, flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', borderBottom: '1px solid var(--line)', fontSize: 'var(--fs-hint)', color: 'var(--tx-3)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
        <span style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${t('code.preview')} · ${frame.width}×${frame.height}`}>{frame.width}×{frame.height}</span>
        <label style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer', flex: 'none' }} title={t('code.guidesHint')}>
          <input type="checkbox" checked={guides} onChange={toggleGuides} /> {t('code.guides')}
        </label>
        <label style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer', flex: 'none', opacity: layout ? 0.5 : 1 }} title={t('code.motionHint')}>
          <input type="checkbox" checked={motion} disabled={layout} onChange={toggleMotion} /> {t('code.motion')}
        </label>
        {tones.length > 0 && (
          <select className="nc-select" style={{ width: 'auto', marginLeft: 'auto', flex: '0 1 auto', minWidth: 0 }} value={tone} onChange={(e) => setTone(e.target.value)}>
            <option value="">{t('code.toneDefault')}</option>
            {tones.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: PANE_INSET, display: 'flex' }}>
        <LookPreview
          fit
          guides={guides}
          options={{ stage, block, tone: tone || undefined, measure: layout, width: frame.width, height: frame.height, animate }}
          delayMs={250}
          style={{ flex: 1 }}
          onRects={onRects}
          overlay={layout ? (scale) => <LayoutOverlay rects={rects} scale={scale} frame={FRAME} selected={selected} onSelect={onSelect} onChange={onBox} /> : undefined}
        />
      </div>
    </div>
  );
};
