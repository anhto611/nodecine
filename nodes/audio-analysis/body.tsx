'use client';
import React from 'react';
import type { AudioTrackSpec } from '@/core/types/payloads';
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
      <div className="nc-hint">{t('node.analysisHint')}</div>
    </>
  );
};
