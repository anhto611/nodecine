'use client';
import React from 'react';
import type { Voiceover } from '@/core/types/payloads';
import { Kv, useT } from '@/components/ui';
import { FormBody } from '@/nodes/form-body';
import { useParams } from '@/nodes/kit';
import type { BodyProps } from '@/nodes/kit';
import { useRuntime } from '@/store/useStudio';
import { AudioPicker, useAudioLibrary } from './picker';

export const AudioInputBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ file: string }>(nodeId);
  const { files, folder, loading } = useAudioLibrary('voice');
  const rt = useRuntime(nodeId);
  const vo = rt?.outputs.voiceover?.payload as Voiceover | undefined;
  return (
    <>
      <Kv k={t('node.file')} v={<AudioPicker files={files} value={p.file ?? ''} empty={t('node.noFile')} onChange={(file) => set({ file })} />} />
      <FormBody nodeId={nodeId} fields={['language']} />
      {vo && <Kv k={t('node.duration')} v={`${vo.durationSeconds.toFixed(2)}s`} />}
      {!loading && !files.length && (
        <>
          <div className="nc-hint">{t('node.voiceEmpty')}</div>
          {folder && <div className="nc-hint one-line" title={folder}>{folder}</div>}
        </>
      )}
      <div className="nc-hint">{t('node.audioInputHint')}</div>
    </>
  );
};
