'use client';
import React from 'react';
import type { SceneScript } from '@/core/types/payloads';
import { Kv, useT } from '@/components/ui';
import { FormBody } from '@/nodes/form-body';
import { useRuntime } from '@/store/useStudio';
import type { BodyProps } from '@/nodes/kit';
import { hasWritten } from './prompt';

export const SceneBreakdownBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const rt = useRuntime(nodeId);
  const out = rt?.outputs.scenes?.payload as SceneScript | undefined;
  const written = out?.scenes.filter((s) => hasWritten(s.content)).length ?? 0;
  return (
    <>
      <FormBody nodeId={nodeId} />
      {out && <Kv k={t('node.written')} v={`${written}/${out.scenes.length}`} dim={!written} />}
      {out && written > 0 && (
        <div className="nc-hint" style={{ whiteSpace: 'pre-wrap' }}>
          {out.scenes.map((s, i) => `${i + 1}. ${s.content.title ?? s.content.quote ?? s.content.number ?? s.content.points?.[0] ?? '—'}`).join('\n')}
        </div>
      )}
      <div className="nc-hint">{t('node.breakdownHint')}</div>
    </>
  );
};
