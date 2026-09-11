'use client';
import React from 'react';
import type { Voiceover } from '@/core/types/payloads';
import { Kv, useT } from '@/components/ui';
import { FormBody } from '@/nodes/form-body';
import { useParams } from '@/nodes/kit';
import type { BodyProps } from '@/nodes/kit';
import { useOutputPayload } from '@/store/useStudio';
import { LibraryPicker, useLibrary } from '@/nodes/library-picker';

export const AudioInputBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ file: string }>(nodeId);
  const { files, folder, loading } = useLibrary('voice');
  const vo = useOutputPayload<Voiceover>(nodeId, 'voiceover');
  return (
    <>
      <Kv k={t('node.file')} v={<LibraryPicker files={files} value={p.file ?? ''} empty={t('node.noFile')} onChange={(file) => set({ file })} />} />
      <FormBody nodeId={nodeId} fields={['language']} />
      {vo && <Kv k={t('node.duration')} v={`${vo.durationSeconds.toFixed(2)}s`} />}
      {!loading && !files.length && (
        <>
          <div className="nc-hint">{t('node.voiceEmpty')}</div>
          {folder && <div className="nc-hint one-line" title={folder}>{folder}</div>}
        </>
      )}
      <div className="nc-hint">{t('node.audioInputHint')}</div>
      <div className="nc-hint">{t('node.audioInputTrack')}</div>
    </>
  );
};
