'use client';
import React from 'react';
import { Kv, useT } from '@/components/ui';
import { FormBody } from '@/nodes/form-body';
import { useParams } from '@/nodes/kit';
import type { BodyProps } from '@/nodes/kit';
import { LibraryPicker, useLibrary } from '@/nodes/library-picker';

export const AudioMixBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ track: string }>(nodeId);
  const { files, folder, loading } = useLibrary('music');
  return (
    <>
      <Kv k={t('node.track')} v={<LibraryPicker files={files} value={p.track ?? ''} empty={t('node.noMusic')} onChange={(track) => set({ track })} />} />
      {p.track ? (
        <FormBody
          nodeId={nodeId}
          fields={['volume', 'duck', 'fadeInSeconds', 'fadeOutSeconds']}
          widgets={{
            volume: { widget: 'range', step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
            duck: { widget: 'range', step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
            fadeInSeconds: { step: 0.5 },
            fadeOutSeconds: { step: 0.5 },
          }}
        />
      ) : (
        <div className="nc-hint">{loading ? t('node.audioLoading') : files.length ? t('node.musicHint') : t('node.musicEmpty')}</div>
      )}
      {!loading && !files.length && folder && <div className="nc-hint one-line" title={folder}>{folder}</div>}
      {p.track ? <div className="nc-hint">{t('node.musicOutputs')}</div> : null}
    </>
  );
};
