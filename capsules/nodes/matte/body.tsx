'use client';
import React from 'react';
import type { Footage } from '@/contracts/types/footage';
import { Kv, useT, stopFlow } from '@/capsules/sdk/ui';
import { FormBody } from '@/capsules/sdk/form-body';
import { useOutputPayload, type BodyProps } from '@/capsules/sdk/host';

/**
 * The cut-out on the card. What it turned out to be is shown once the node has run, because that is
 * measured from the file; before that, all this card can honestly say is how long it will take.
 */
export const MatteBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const out = useOutputPayload<Footage>(nodeId, 'footage');
  return (
    <>
      <FormBody nodeId={nodeId} />
      {out
        ? <>
            <Kv k={t('node.matteSize')} v={`${out.width}×${out.height}`} />
            {/* The one thing that tells a cut-out from any other clip, so it is worth showing. */}
            <video className={stopFlow} src={out.url} controls muted playsInline preload="metadata"
              style={{ width: '100%', maxHeight: 260, borderRadius: 6, background: 'repeating-conic-gradient(#3a3a3a 0% 25%, #2a2a2a 0% 50%) 0 0/24px 24px' }} />
          </>
        : <div className="nc-hint">{t('node.matteHint')}</div>}
    </>
  );
};
