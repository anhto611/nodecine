'use client';
import React from 'react';
import { useT, stopFlow } from '@/components/ui';
import { useParams, type BodyProps } from '@/nodes/kit';

export const InputTriggerBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ value: string }>(nodeId);
  return (
    <>
      <textarea className={`nc-textarea ${stopFlow}`} value={p.value} placeholder="…" onChange={(e) => set({ value: e.target.value })} />
      <div className="nc-hint">{t('node.chars', { n: p.value.trim().length })}</div>
    </>
  );
};
