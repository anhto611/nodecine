'use client';
import React from 'react';
import type { LayerSheet, LayerSpec, StyleSheet } from '@/contracts/types/payloads';
import { Btn, Kv, useT } from '@/components/ui';
import { ProviderPick } from '@/components/node-runtime/provider-pick';
import { FormBody } from '@/nodes/form-body';
import { FormPicker } from '@/nodes/form-picker';
import { useOutputPayload, useStudio } from '@/store/useStudio';
import { ScenePreview } from '@/components/ScenePreview';
import { Icon } from '@/components/icons';
import type { BodyProps } from '@/nodes/kit';
import type { SetParams } from './node';

/** The Set's own things: layers it drew, which are always code and always named. */
const drawnLayers = (sheet: LayerSheet | undefined) =>
  (sheet?.layers ?? []).filter((l): l is Extract<LayerSpec, { kind: 'code' }> => l.kind === 'code');

type Member = SetParams['members'][number];
const blank = (n: number): Member => ({ id: `thing${n}`, brief: '', placement: 'over', width: 0, height: 0, source: '', homeX: 0, homeY: 0, homeWidth: 0, homeHeight: 0 });

/**
 * Everything that does not change, in one frame: the sheet's ground and type, every member that
 * carries its own drawing stacked in the order the film stacks them, and a line of words where the
 * film writes them.
 *
 * The members are drawn still. Their scripts read the beats to travel with the scenes, and there
 * are no scenes here, so what this shows is where they start and how much room they leave — which
 * is the question a shell is looked at to answer.
 */
export const ShellPreview: React.FC<{ sheet: StyleSheet; cast?: LayerSheet; width?: number; fit?: boolean; guides?: boolean }> = ({ sheet, cast, width = 36, fit, guides }) => {
  const members = drawnLayers(cast).filter((m) => m.source.trim());
  const source = [...members.filter((m) => m.placement === 'under'), ...members.filter((m) => m.placement === 'over')].map((m) => m.source).join('\n');
  const options = { style: sheet.style, source: source || '<div></div>', width: sheet.frame.width, height: sheet.frame.height, captions: SAMPLE_CAPTION };
  const h = Math.round((width * sheet.frame.height) / sheet.frame.width);
  if (fit) return <ScenePreview fit guides={guides} options={options} style={{ flex: 1, minHeight: 0 }} />;
  return (
    <div style={{ width, height: h, borderRadius: 2, overflow: 'hidden', background: '#000' }}>
      <ScenePreview options={options} style={{ width, height: h }} />
    </div>
  );
};

/** Long enough to wrap to the two lines the band allows, so the room it takes is the real room. */
const SAMPLE_CAPTION = 'Một dòng lời thoại mẫu để xem dải chữ nằm ở đâu';

/**
 * The set: the look at the top, then the things that stay on screen, one line each. A member is
 * edited in the dialog, where a brief has room to be more than two lines.
 */
export const SetBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const sheet = useOutputPayload<StyleSheet>(nodeId, 'style');
  const cast = useOutputPayload<LayerSheet>(nodeId, 'layers');
  const setOverlay = useStudio((s) => s.setOverlay);
  const setParams = useStudio((s) => s.setParams);
  const node = useStudio((s) => s.graph.nodes.find((n) => n.id === nodeId));
  const members = ((node?.params as { members?: Member[] } | undefined)?.members) ?? [];
  const open = (i: number) => setOverlay({ nodeId, data: { member: i } });
  return (
    <>
      <ProviderPick nodeId={nodeId} kind="llm" />
      <FormBody nodeId={nodeId} fields={['brief', 'frame', 'ground', 'language']} omit={['llmProvider', 'llmSettings']} widgets={{ brief: { widget: 'textarea', placeholder: t('style.briefPlaceholder') } }} />
      {/* A name out of the registry, not a name typed from memory: there are six of them and a
          misspelling is an error at run time rather than a choice the person can see. */}
      <FormPicker nodeId={nodeId} />
      <Kv k={t('node.core/set')} v={sheet ? sheet.style.name : '—'} dim={!sheet} />
      {sheet ? <ShellPreview sheet={sheet} cast={cast} /> : null}

      {members.map((m, i) => {
        const drawn = drawnLayers(cast).find((x) => x.id === m.id);
        return (
          <div key={i} className="nc-scene-line nodrag" title={t('cast.openHint')} onClick={() => open(i)}>
            <span className="nc-k" style={{ color: 'var(--accent-2)', flex: 'none', width: 16 }}>{i + 1}</span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
                <span className="nc-k" style={{ minWidth: 0 }}>{m.id || t('cast.namePlaceholder')}</span>
                <span className="nc-chip" style={{ cursor: 'inherit' }}>{t(m.placement === 'over' ? 'node.spanningPlacement.over' : 'node.spanningPlacement.under')}</span>
                {drawn ? <span className="nc-chip" style={{ cursor: 'inherit' }}>{drawn.width}×{drawn.height}</span> : null}
              </span>
              <span style={{ minWidth: 0, color: m.brief.trim() ? 'var(--tx)' : 'var(--tx-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.brief.trim() || t('cast.briefPlaceholder')}</span>
            </span>
            <span className="nc-scene-tools" onClick={(e) => e.stopPropagation()}>
              <button className="nc-chip" onClick={() => setParams(nodeId, { members: members.filter((_, j) => j !== i) })} title={t('common.remove')}><Icon.x size={9} /></button>
            </span>
          </div>
        );
      })}
      <Btn small className="nodrag" onClick={() => { setParams(nodeId, { members: [...members, blank(members.length + 1)] }); open(members.length); }} style={{ alignSelf: 'flex-start' }}>
        <Icon.plus size={10} /> {t('cast.add')}
      </Btn>
      <div className="nc-hint">{t('set.hint')}</div>
    </>
  );
};
