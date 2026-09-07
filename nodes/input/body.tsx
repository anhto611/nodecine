'use client';
import React from 'react';
import { useT, stopFlow } from '@/components/ui';
import { FormBody } from '@/nodes/form-body';
import { batchLines } from '@/core/engine/batch';
import { useParams, type BodyProps } from '@/nodes/kit';

export const InputTriggerBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ value: string; perRun: boolean }>(nodeId);
  const lines = batchLines(p as unknown as Record<string, unknown>);
  return (
    <>
      <FormBody nodeId={nodeId} fields={['value']} widgets={{ value: { widget: 'textarea', label: false, placeholder: '…' } }} />
      <label className={`nc-hint ${stopFlow}`} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input type="checkbox" checked={!!p.perRun} onChange={(e) => set({ perRun: e.target.checked })} />
        {t('node.perRun')}
      </label>
      <div className="nc-hint">{p.perRun ? t('node.perRunCount', { n: lines.length }) : t('node.chars', { n: (p.value ?? '').trim().length })}</div>
    </>
  );
};
