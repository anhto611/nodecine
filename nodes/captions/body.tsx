'use client';
import React from 'react';
import type { CaptionTrack } from '@/core/types/payloads';
import { Kv, useT, stopFlow } from '@/components/ui';
import { useRuntime } from '@/store/useStudio';
import { useParams, type BodyProps } from '@/nodes/kit';

export const CaptionsBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ maxChars: number }>(nodeId);
  const rt = useRuntime(nodeId);
  const track = rt?.outputs.captions?.payload as CaptionTrack | undefined;
  return (
    <>
      <Kv k={t('node.maxChars')} v={<input className={`nc-input ${stopFlow}`} type="number" min={8} max={80} step={1} value={p.maxChars ?? 26} onChange={(e) => set({ maxChars: Math.max(8, Math.min(80, Math.round(Number(e.target.value) || 26))) })} />} />
      <Kv k={t('node.lines')} v={track ? String(track.cues.length) : '—'} dim={!track} />
      {track && track.cues.slice(0, 3).map((c, i) => (
        <div key={i} className="nc-hint one-line" title={c.words.map((w) => w.text).join(' ')}>{c.start.toFixed(1)}s · {c.words.map((w) => w.text).join(' ')}</div>
      ))}
      <div className="nc-hint">{t('node.captionsHint')}</div>
    </>
  );
};
