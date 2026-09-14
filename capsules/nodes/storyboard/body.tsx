'use client';
import React from 'react';
import { Kv, useT, stopFlow } from '@/capsules/sdk/ui';
import { useParams, type BodyProps } from '@/capsules/sdk/host';
import { readStoryboard } from './read';

export const StoryboardBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ markdown: string; language: string }>(nodeId);
  const markdown = p.markdown ?? '';
  const reading = React.useMemo(() => (markdown.trim() ? readStoryboard(markdown) : null), [markdown]);
  const frames = reading?.storyboard?.frames ?? [];
  return (
    <>
      <textarea
        className={`nc-textarea ${stopFlow}`}
        style={{ minHeight: 220, fontFamily: 'ui-monospace, Menlo, monospace' }}
        placeholder={t('node.storyboardPlaceholder')}
        value={markdown}
        onChange={(e) => set({ markdown: e.target.value })}
        spellCheck={false}
      />
      <Kv k={t('node.language')} v={
        <select className={`nc-select ${stopFlow}`} value={p.language ?? 'vi'} onChange={(e) => set({ language: e.target.value })}>
          <option value="vi">{t('node.language.vi')}</option>
          <option value="en">{t('node.language.en')}</option>
        </select>
      } />
      {reading?.storyboard && (
        <>
          <Kv k="" v={t('node.storyboardSummary', { frames: frames.length, spoken: frames.filter((f) => f.voiceover).length, mounts: frames.reduce((n, f) => n + f.mounts.length, 0) })} dim />
          <div className={stopFlow} style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 180, overflowY: 'auto' }}>
            {frames.map((f) => (
              <div key={f.number} style={{ fontSize: 'var(--fs-hint)', color: 'var(--tx-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {f.number}. {f.title} · {f.mounts.map((m) => m.component).join(', ') || '—'}
              </div>
            ))}
          </div>
        </>
      )}
      {reading && !reading.storyboard && <div style={{ fontSize: 'var(--fs-hint)', color: 'var(--err)' }}>{reading.problems.slice(0, 3).join(' · ')}</div>}
    </>
  );
};
