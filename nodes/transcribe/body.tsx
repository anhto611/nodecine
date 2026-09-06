'use client';
import React from 'react';
import type { Voiceover } from '@/core/types/payloads';
import { Kv, useT, stopFlow } from '@/components/ui';
import { useRuntime } from '@/store/useStudio';
import { useParams, type BodyProps } from '@/nodes/kit';
import { ALIGN_MODELS } from './node';

export const TranscribeBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ model: string }>(nodeId);
  const rt = useRuntime(nodeId);
  const vo = rt?.outputs.voiceover?.payload as Voiceover | undefined;
  const words = vo?.words ?? [];
  return (
    <>
      <Kv k={t('node.model')} v={<select className={`nc-select ${stopFlow}`} value={p.model ?? 'small'} onChange={(e) => set({ model: e.target.value })}>
        {ALIGN_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>} />
      <Kv k={t('node.words')} v={words.length ? String(words.length) : '—'} dim={!words.length} />
      {words.length > 0 && <div className="nc-hint one-line" title={words.map((w) => `${w.text} ${w.start.toFixed(2)}`).join(' · ')}>{words.slice(0, 6).map((w) => `${w.text} ${w.start.toFixed(2)}`).join(' · ')}…</div>}
      <div className="nc-hint">{t('node.transcribeHint')}</div>
    </>
  );
};
