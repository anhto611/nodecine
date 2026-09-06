'use client';
import React from 'react';
import type { Voiceover } from '@/core/types/payloads';
import { Kv, useT } from '@/components/ui';
import { FormBody } from '@/nodes/form-body';
import { useRuntime } from '@/store/useStudio';
import type { BodyProps } from '@/nodes/kit';

export const TranscribeBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const rt = useRuntime(nodeId);
  const vo = rt?.outputs.voiceover?.payload as Voiceover | undefined;
  const words = vo?.words ?? [];
  return (
    <>
      <FormBody nodeId={nodeId} />
      <Kv k={t('node.words')} v={words.length ? String(words.length) : '—'} dim={!words.length} />
      {words.length > 0 && <div className="nc-hint one-line" title={words.map((w) => `${w.text} ${w.start.toFixed(2)}`).join(' · ')}>{words.slice(0, 6).map((w) => `${w.text} ${w.start.toFixed(2)}`).join(' · ')}…</div>}
      <div className="nc-hint">{t('node.transcribeHint')}</div>
    </>
  );
};
