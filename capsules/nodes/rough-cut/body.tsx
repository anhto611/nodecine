'use client';
import React from 'react';
import { FormBody } from '@/capsules/sdk/form-body';
import { useOutputPayload, useT, type BodyProps } from '@/capsules/sdk/host';
import type { Storyboard } from '@/contracts/types/storyboard';

/** How the recording is cut, and what came of it once the node has run. */
export const RoughCutBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const out = useOutputPayload<Storyboard>(nodeId, 'storyboard');
  return (
    <>
      <FormBody nodeId={nodeId} fields={['targetSeconds', 'minSeconds', 'pauseSeconds']} widgets={{
        targetSeconds: { labelKey: 'node.roughCutTarget', widget: 'range', step: 0.5, format: (v) => `${v.toFixed(1)}s` },
        minSeconds: { labelKey: 'node.roughCutMin', widget: 'range', step: 0.5, format: (v) => `${v.toFixed(1)}s` },
        pauseSeconds: { labelKey: 'node.roughCutPause', widget: 'range', step: 0.05, format: (v) => `${v.toFixed(2)}s` },
      }} />
      {out
        ? <div className="nc-hint">{out.frames.length} {t('node.roughCutScenes')} · {out.frames.map((f) => f.title).slice(0, 3).join(' · ')}…</div>
        : <div className="nc-hint">{t('node.roughCutHint')}</div>}
    </>
  );
};
