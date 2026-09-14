'use client';
import React from 'react';
import { ProviderPick } from '@/components/node-runtime/provider-pick';
import type { SceneScript } from '@/contracts/types/payloads';
import { Kv, useT } from '@/components/ui';
import { FormBody } from '@/nodes/form-body';
import { useInputPayload, useOutputPayload } from '@/store/useStudio';
import type { BodyProps } from '@/nodes/kit';

export const StockMediaBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const llm = useInputPayload(nodeId, 'llm');
  const out = useOutputPayload<SceneScript>(nodeId, 'scenes');
  const found = out?.scenes.filter((s) => s.content.image || s.content.clip).length ?? 0;
  return (
    <>
      <ProviderPick nodeId={nodeId} kind="llm" optional />
      <FormBody nodeId={nodeId} omit={['llmProvider', 'llmSettings']} />
      {out && <Kv k={t('node.footage')} v={`${found}/${out.scenes.length}`} dim={!found} />}
      {found > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
          {out!.scenes.filter((s) => s.content.image || s.content.clip).slice(0, 6).map((s, i) => {
            const style = { width: 40, height: 26, objectFit: 'cover' as const, borderRadius: 3, border: '1px solid var(--line-2)' };
            return s.content.clip ? <video key={i} src={s.content.clip} muted playsInline style={style} /> : <img key={i} src={s.content.image} alt="" style={style} />;
          })}
        </div>
      )}
      <div className="nc-hint">{llm ? t('node.stockHint') : t('node.stockNoLlm')}</div>
    </>
  );
};
