'use client';
import React from 'react';
import { Btn, useT } from '@/capsules/sdk/ui';
import { ProviderPick } from '@/capsules/sdk/pickers';
import { useOutputPayload, useParams, type BodyProps } from '@/capsules/sdk/host';
import type { Storyboard } from '@/contracts/types/storyboard';

/** The model that dresses the scenes, and what it decided last time. */
export const CoverageBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ attempt?: number }>(nodeId);
  const out = useOutputPayload<Storyboard>(nodeId, 'storyboard');
  const blocks = out ? [...new Set(out.frames.map((f) => f.block ?? '—'))] : [];
  return (
    <>
      <ProviderPick nodeId={nodeId} kind="llm" />
      <div>
        <Btn onClick={() => set({ attempt: (p.attempt ?? 0) + 1 })}>{t('node.coverageAgain')}</Btn>
      </div>
      {out
        ? <div className="nc-hint">{out.frames.length} {t('node.coverageDressed')} · {blocks.join(' · ')}</div>
        : <div className="nc-hint">{t('node.coverageHint')}</div>}
    </>
  );
};
