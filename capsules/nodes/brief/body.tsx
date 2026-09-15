'use client';
import React from 'react';
import { useT, stopFlow } from '@/capsules/sdk/ui';
import { useLocale, useParams, type BodyProps } from '@/capsules/sdk/host';
import { FormBody } from '@/capsules/sdk/form-body';

/** The one box: what the video is about. */
export const BriefBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const locale = useLocale();
  const [p] = useParams<{ hint: Record<string, string> }>(nodeId);
  const hint = p.hint?.[locale] ?? p.hint?.[locale.split('-')[0]!] ?? t('node.briefAboutHint');
  return (
    <div className={stopFlow} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <FormBody nodeId={nodeId} fields={['about']} widgets={{ about: { widget: 'textarea', rows: 4, placeholder: hint, labelKey: 'node.briefAbout' } }} />
    </div>
  );
};
