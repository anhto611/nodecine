'use client';
import React from 'react';
import type { PlateSheet, StyleSheet } from '@/contracts/types/payloads';
import { Btn, Kv, useT } from '@/components/ui';
import { Icon } from '@/components/icons';
import { ProviderPick } from '@/components/node-runtime/provider-pick';
import { ScenePreview } from '@/components/ScenePreview';
import { FormBody } from '@/nodes/form-body';
import { useInputPayload, useOutputPayload, useStudio } from '@/store/useStudio';
import type { BodyProps } from '@/nodes/kit';

/**
 * The plates it drew, as plates: one small frame each, the placeholders still in the holes.
 *
 * A list of ids and key counts said a plate existed and nothing about what it looks like — and the
 * whole promise of a plate is that you approve a layout once and every later video is drawn in it.
 * You cannot approve what you cannot see. Click one for the whole frame.
 */
export const PlatesBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const sheet = useOutputPayload<PlateSheet>(nodeId, 'plates');
  const style = useInputPayload<StyleSheet>(nodeId, 'style');
  const setOverlay = useStudio((s) => s.setOverlay);
  const frame = style?.frame ?? { width: 1080, height: 1920 };
  const w = 36;
  const h = Math.round((w * frame.height) / frame.width);
  /**
   * A card is 220 pixels wide and a catalogue can be long. It shows the first two rows and says how
   * many more there are; the store is where a catalogue is read. Ten frames is also ten documents
   * to build, and a card that builds a hundred of them stalls the canvas it sits on.
   */
  const MAX = 10;
  const all = sheet?.plates ?? [];
  const shown = all.slice(0, MAX);
  const rest = all.length - shown.length;
  return (
    <>
      <ProviderPick nodeId={nodeId} kind="llm" />
      <FormBody nodeId={nodeId} omit={['llmProvider', 'llmSettings']} />
      <Kv k={t('plates.count', { n: sheet?.plates.length ?? 0 })} v={sheet ? '' : t('plates.none')} dim={!sheet} />
      {sheet && style ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {shown.map((p, i) => (
            <div key={p.id} className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: 2, width: w, cursor: 'pointer' }} title={`${p.id} · ${p.keys.join(', ')}`} onClick={() => setOverlay({ nodeId, data: { plate: i } })}>
              <div className="nc-k" style={{ fontSize: 'var(--fs-hint)', color: 'var(--accent-2)' }}>{i + 1}</div>
              <div style={{ width: w, height: h, borderRadius: 2, overflow: 'hidden', background: '#000' }}>
                <ScenePreview options={{ style: style.style, source: p.source, width: frame.width, height: frame.height }} style={{ width: w, height: h }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {sheet && style ? (
        <Btn small className="nodrag" onClick={() => setOverlay({ nodeId, data: { plate: 0 } })} style={{ alignSelf: 'flex-start' }}>
          <Icon.brush size={10} /> {rest > 0 ? t('plateStore.openRest', { n: rest }) : t('plateStore.openAll')}
        </Btn>
      ) : null}
      {sheet && !style ? <div className="nc-hint">{t('plates.needStyle')}</div> : null}
      <div className="nc-hint">{t('plates.hint')}</div>
    </>
  );
};
