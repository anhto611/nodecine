'use client';
import React from 'react';
import type { AudioTrackSpec } from '@/contracts/types/payloads';
import { Kv, useT } from '@/components/ui';
import { FormBody } from '@/nodes/form-body';
import { useOutputPayload } from '@/store/useStudio';
import type { BodyProps } from '@/nodes/kit';

export const AudioAnalysisBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const out = useOutputPayload<AudioTrackSpec>(nodeId, 'track');
  return (
    <>
      <FormBody nodeId={nodeId} />
      {out?.analysisUrl ? <Kv k={t('node.analysed')} v={`${out.role} · ${out.durationSeconds.toFixed(1)}s`} /> : null}
      {out?.beatSeconds?.length ? <Kv k={t('node.beats')} v={`${out.beatSeconds.length} · ${(out.beatSeconds.length / Math.max(1, out.durationSeconds) * 60).toFixed(0)} bpm`} /> : null}
      <div className="nc-hint">{t('node.analysisHint')}</div>
    </>
  );
};
