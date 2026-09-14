'use client';
import React from 'react';
import type { CaptionTrack, Voiceover } from '@/contracts/types/payloads';
import { Kv, useT } from '@/capsules/sdk/ui';
import { FormBody } from '@/capsules/sdk/form-body';
import { useOutputPayload, type BodyProps } from '@/capsules/sdk/host';

export const TranscribeBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const vo = useOutputPayload<Voiceover>(nodeId, 'voiceover');
  const track = useOutputPayload<CaptionTrack>(nodeId, 'captions');
  const words = vo?.words ?? [];
  return (
    <>
      <FormBody nodeId={nodeId} />
      <Kv k={t('node.words')} v={words.length ? String(words.length) : '—'} dim={!words.length} />
      <Kv k={t('node.lines')} v={track ? String(track.cues.length) : '—'} dim={!track} />
      {track ? track.cues.slice(0, 3).map((c, i) => (
        <div key={i} className="nc-hint one-line" title={c.words.map((w) => w.text).join(' ')}>{c.start.toFixed(1)}s · {c.words.map((w) => w.text).join(' ')}</div>
      )) : null}
      <div className="nc-hint">{t('node.transcribeHint')}</div>
    </>
  );
};
