'use client';
import React from 'react';
import type { ScenePlan } from '@/contracts/types/payloads';
import { Kv, useT } from '@/components/ui';
import { FormBody } from '@/nodes/form-body';
import { useOutputPayload } from '@/store/useStudio';
import { Storyboard } from '@/components/node-runtime/storyboard';
import type { BodyProps } from '@/nodes/kit';

/** What it built, drawn small: the same storyboard the Illustrator shows, from plates instead. */
export const ComposeBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const plan = useOutputPayload<ScenePlan>(nodeId, 'plan');
  return (
    <>
      <FormBody nodeId={nodeId} />
      <Kv k={t('compose.filled', { n: plan?.scenes.length ?? 0 })} v="" dim={!plan} />
      {plan ? <Storyboard plan={plan} width={36} /> : null}
      <div className="nc-hint">{t('compose.hint')}</div>
    </>
  );
};
