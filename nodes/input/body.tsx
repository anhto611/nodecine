'use client';
import React from 'react';
import { useT } from '@/components/ui';
import { FormBody } from '@/nodes/form-body';
import { useParams, type BodyProps } from '@/nodes/kit';

export const InputTriggerBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p] = useParams<{ value: string }>(nodeId);
  return (
    <>
      <FormBody nodeId={nodeId} fields={['value']} widgets={{ value: { widget: 'textarea', label: false, placeholder: '…' } }} />
      <div className="nc-hint">{t('node.chars', { n: (p.value ?? '').trim().length })}</div>
    </>
  );
};
