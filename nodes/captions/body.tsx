'use client';
import React from 'react';
import type { CaptionTrack } from '@/core/types/payloads';
import { Kv, useT } from '@/components/ui';
import { FormBody } from '@/nodes/form-body';
import { useOutputPayload } from '@/store/useStudio';
import type { BodyProps } from '@/nodes/kit';

export const CaptionsBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const track = useOutputPayload<CaptionTrack>(nodeId, 'captions');
  return (
    <>
      <FormBody nodeId={nodeId} />
      <Kv k={t('node.lines')} v={track ? String(track.cues.length) : '—'} dim={!track} />
      {track && track.cues.slice(0, 3).map((c, i) => (
        <div key={i} className="nc-hint one-line" title={c.words.map((w) => w.text).join(' ')}>{c.start.toFixed(1)}s · {c.words.map((w) => w.text).join(' ')}</div>
      ))}
      <div className="nc-hint">{t('node.captionsHint')}</div>
    </>
  );
};
