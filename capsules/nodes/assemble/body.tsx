'use client';
import React from 'react';
import { Kv, useT, stopFlow } from '@/capsules/sdk/ui';
import { useOutputPayload, type BodyProps } from '@/capsules/sdk/host';
import type { Composition } from '@/contracts/types/composition';
import { TIMELINE_FILE } from './assemble';

type Placed = { number: number; title: string; start: number; duration: number; file: string; block?: string };

export const AssembleBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const out = useOutputPayload<Composition>(nodeId, 'composition');
  const timeline = React.useMemo(() => {
    try { return out?.files[TIMELINE_FILE] ? JSON.parse(out.files[TIMELINE_FILE]!) as { durationSeconds: number; frames: Placed[] } : null; } catch { return null; }
  }, [out]);
  if (!timeline) return <div className="nc-hint">{t('node.assembleWaiting')}</div>;
  return (
    <>
      <Kv k="" v={t('node.assembleFrames', { count: timeline.frames.length, seconds: timeline.durationSeconds.toFixed(1) })} dim />
      <div className={stopFlow} style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflowY: 'auto' }}>
        {timeline.frames.map((f) => (
          <div key={f.number} style={{ display: 'flex', gap: 6, fontSize: 'var(--fs-hint)', color: 'var(--tx-2)' }}>
            <span style={{ width: 86, flex: 'none', color: 'var(--tx-3)' }}>{f.start.toFixed(1)}–{(f.start + f.duration).toFixed(1)}s</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.number}. {f.title}{f.block ? ` · ${f.block}` : ''}</span>
          </div>
        ))}
      </div>
    </>
  );
};
