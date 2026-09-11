'use client';
import React from 'react';
import { Kv, useT } from '@/components/ui';
import { ClipPick, ImagePick } from '@/components/node-runtime/content-editor';
import { FormBody } from '@/nodes/form-body';
import { useParams } from '@/nodes/kit';
import type { BodyProps } from '@/nodes/kit';
import type { LayerParams } from './node';

const IMAGE = /\.(png|jpe?g|webp|gif|svg)$|^data:image\//i;

export const LayerBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<LayerParams>(nodeId);
  const url = p.url ?? '';
  const isImage = IMAGE.test(url);
  return (
    <>
      <FormBody nodeId={nodeId} fields={['kind', 'placement']} />
      {(p.kind ?? 'media') === 'media' ? (
        <>
          <Kv
            k={t('node.layerFile')}
            v={
              <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
                <ClipPick url={url && !isImage ? url : undefined} onPick={(u) => set({ url: u ?? '' })} />
                <ImagePick url={url && isImage ? url : undefined} onPick={(u) => set({ url: u ?? '' })} />
              </span>
            }
          />
          <FormBody nodeId={nodeId} fields={['fit', 'loop', 'offsetSeconds', 'gain']} widgets={{ gain: { widget: 'range', step: 0.05, format: (v) => `${Math.round(v * 100)}%` } }} />
        </>
      ) : (
        <FormBody nodeId={nodeId} fields={['source']} widgets={{ source: { widget: 'textarea', placeholder: t('node.layerSourcePlaceholder') } }} />
      )}
      <FormBody nodeId={nodeId} fields={['startSeconds', 'durationSeconds']} />
      <div className="nc-hint">{t('node.layerHint')}</div>
    </>
  );
};
