'use client';
import React from 'react';
import { Kv, useT, stopFlow } from '@/capsules/sdk/ui';
import { useOutputPayload, useParams, type BodyProps } from '@/capsules/sdk/host';
import { COMPOSITION_ENTRY, type Composition } from '@/contracts/types/composition';

export const CompositionBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ files: Record<string, string> }>(nodeId);
  const out = useOutputPayload<Composition>(nodeId, 'composition');
  const files = p.files ?? {};
  return (
    <>
      <Kv k={t('node.compositionEntry')} v={`${Object.keys(files).length} files`} />
      <textarea
        className={`nc-textarea ${stopFlow}`}
        style={{ fontFamily: 'ui-monospace, Menlo, monospace', minHeight: 120 }}
        value={files[COMPOSITION_ENTRY] ?? ''}
        onChange={(e) => set({ files: { ...files, [COMPOSITION_ENTRY]: e.target.value } })}
        spellCheck={false}
      />
      {out && (
        <>
          <Kv k={t('node.compositionSize')} v={`${out.width}×${out.height} · ${out.fps}fps`} />
          <Kv k={t('node.compositionVariables')} v={out.variables.length ? out.variables.map((v) => `${v.id}: ${v.type}`).join(', ') : t('node.compositionNone')} />
        </>
      )}
    </>
  );
};
