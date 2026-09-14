'use client';
import React from 'react';
import { Kv, useT, stopFlow } from '@/capsules/sdk/ui';
import { useParams, type BodyProps } from '@/capsules/sdk/host';
import { SCRIPT_LANGUAGES, segmentsOf } from './node';

export const ScriptBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ text: string; language: string }>(nodeId);
  const text = p.text ?? '';
  const segments = segmentsOf(text);
  const words = segments.join(' ').split(' ').filter(Boolean).length;
  return (
    <>
      <textarea
        className={`nc-textarea ${stopFlow}`}
        style={{ minHeight: 180 }}
        placeholder={t('node.scriptPlaceholder')}
        value={text}
        onChange={(e) => set({ text: e.target.value })}
      />
      <Kv k={t('node.language')} v={
        <select className={`nc-select ${stopFlow}`} value={p.language ?? 'vi'} onChange={(e) => set({ language: e.target.value })}>
          {SCRIPT_LANGUAGES.map((l) => <option key={l} value={l}>{t(`node.language.${l}`)}</option>)}
          {!SCRIPT_LANGUAGES.includes((p.language ?? 'vi') as never) && <option value={p.language}>{p.language}</option>}
        </select>
      } />
      <Kv k="" v={t('node.scriptSegments', { count: segments.length, words })} dim />
    </>
  );
};
