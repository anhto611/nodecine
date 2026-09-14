'use client';
import React from 'react';
import { Btn, Dialog, Kv, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useNode, useOutputPayload, useStudio } from '@/store/useStudio';
import { ScenePreview } from '@/components/ScenePreview';
import type { LayerSheet, LayerSpec, StyleSheet } from '@/contracts/types/payloads';
import type { SetParams } from './node';

type Member = SetParams['members'][number];

/**
 * One member of the cast, with room to describe it (USER_FLOWS §1.10).
 *
 * A member is a name, a few sentences about what it is, where it sits, and sometimes a size. That
 * never fitted in the 220 pixels of a node: the brief is the part that decides what gets drawn, and
 * it was a two-line box. A line on the node, the whole of it here.
 */
const isMemberTarget = (o: { nodeId: string; data?: unknown }): o is { nodeId: string; data: { member: number } } => typeof (o.data as { member?: unknown } | undefined)?.member === 'number';

export const SetMemberDialog: React.FC = () => {
  const t = useT();
  const overlay = useStudio((s) => s.overlay);
  const setOverlay = useStudio((s) => s.setOverlay);
  const setParams = useStudio((s) => s.setParams);
  const target = React.useMemo(() => (overlay && isMemberTarget(overlay) ? { nodeId: overlay.nodeId, index: overlay.data.member } : null), [overlay]);
  const node = useNode(target?.nodeId ?? '');
  const sheet = useOutputPayload<StyleSheet>(target?.nodeId ?? '', 'style');
  const cast = useOutputPayload<LayerSheet>(target?.nodeId ?? '', 'layers');
  const members = React.useMemo(() => (node?.params as { members?: Member[] } | undefined)?.members ?? [], [node]);
  const index = target?.index ?? 0;
  const member = members[index];
  const close = () => setOverlay(null);
  const go = (i: number) => { if (i >= 0 && i < members.length) setOverlay({ nodeId: target!.nodeId, data: { member: i } }); };
  const update = (patch: Partial<Member>) => setParams(target!.nodeId, { members: members.map((m, j) => (j === index ? { ...m, ...patch } : m)) });
  const remove = () => { setParams(target!.nodeId, { members: members.filter((_, j) => j !== index) }); setOverlay(null); };

  React.useEffect(() => {
    if (target && (!node || !members[index])) setOverlay(null);
  }, [target, node, members, index, setOverlay]);
  if (!target || !member) return null;

  const elsewhere = member.width > 0 && member.height > 0;
  const drawn = (cast?.layers ?? []).filter((l): l is Extract<LayerSpec, { kind: 'code' }> => l.kind === 'code').find((x) => x.id === member.id && x.source.trim());
  return (
    <Dialog
      width="min(880px, 92vw)"
      height="min(600px, 88vh)"
      icon={<Icon.layers size={14} />}
      title={<span style={{ fontWeight: 400 }}>{t('cast.memberOf', { i: index + 1, n: members.length })}</span>}
      titleExtra={
        <input className={`nc-input ${stopFlow}`} style={{ width: 160 }} value={member.id} placeholder={t('cast.namePlaceholder')} title={t('cast.nameHint')} onChange={(e) => update({ id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })} />
      }
      onClose={close}
      closeTitle={t('script.done')}
      onKey={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(index + (e.key === 'ArrowLeft' ? -1 : 1)); } }}
      footer={<>
        <Btn small disabled={index === 0} onClick={() => go(index - 1)}>‹ {t('script.prev')}</Btn>
        <Btn small disabled={index >= members.length - 1} onClick={() => go(index + 1)}>{t('script.next')} ›</Btn>
        <Btn small onClick={remove}><Icon.trash size={10} /> {t('cast.remove')}</Btn>
        <div style={{ flex: 1 }} />
        <Btn primary onClick={close}>{t('script.done')}</Btn>
      </>}
    >
      {/* Side by side: the drawing is a portrait frame and the fields are short lines, so stacking
          them spent the dialog's width on nothing and squeezed both. The drawing takes the height
          it is given; the fields scroll on their own. */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12, padding: 12 }}>
        {drawn && sheet ? (
          <div style={{ flex: '0 0 260px', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Its own script places and reveals it, so the preview runs that script on a loop.
                A still of one of these is an empty frame: they start `visibility: hidden`. */}
            <ScenePreview
              animate
              fit
              guides
              options={{ style: sheet.style, source: drawn.source, width: sheet.frame.width, height: sheet.frame.height }}
              style={{ flex: 1, minHeight: 0 }}
            />
            <div className="nc-hint" style={{ flex: 'none' }}>{t('cast.drawnHint')}</div>
          </div>
        ) : null}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        <div className="nc-k">{t('cast.brief')}</div>
        <textarea className={`nc-textarea ${stopFlow}`} style={{ minHeight: 140, resize: 'none', fontSize: 'var(--fs-label)', lineHeight: 1.6 }} placeholder={t('cast.briefPlaceholder')} value={member.brief} onChange={(e) => update({ brief: e.target.value })} autoFocus />

        <Kv k={t('node.spanningPlacement')} v={
          <select className={`nc-select ${stopFlow}`} value={member.placement} onChange={(e) => update({ placement: e.target.value as Member['placement'] })}>
            <option value="over">{t('node.spanningPlacement.over')}</option>
            <option value="under">{t('node.spanningPlacement.under')}</option>
          </select>
        } />

        <Kv k={t('cast.size')} v={
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input className={`nc-input ${stopFlow}`} type="number" min={0} style={{ width: 72 }} value={member.width} onChange={(e) => update({ width: Math.max(0, Number(e.target.value) || 0) })} />
            <span className="nc-k">×</span>
            <input className={`nc-input ${stopFlow}`} type="number" min={0} style={{ width: 72 }} value={member.height} onChange={(e) => update({ height: Math.max(0, Number(e.target.value) || 0) })} />
            {elsewhere ? <span className="nc-k">· {t('cast.drawnElsewhere')}</span> : null}
          </span>
        } />
        <div className="nc-hint">{t('cast.sizeHint')}</div>

        <Kv k={t('cast.home')} v={
          <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className={`nc-input ${stopFlow}`} type="number" min={0} style={{ width: 64 }} value={member.homeX} onChange={(e) => update({ homeX: Math.max(0, Number(e.target.value) || 0) })} />
            <span className="nc-k">,</span>
            <input className={`nc-input ${stopFlow}`} type="number" min={0} style={{ width: 64 }} value={member.homeY} onChange={(e) => update({ homeY: Math.max(0, Number(e.target.value) || 0) })} />
            <span className="nc-k">·</span>
            <input className={`nc-input ${stopFlow}`} type="number" min={0} style={{ width: 64 }} value={member.homeWidth} onChange={(e) => update({ homeWidth: Math.max(0, Number(e.target.value) || 0) })} />
            <span className="nc-k">×</span>
            <input className={`nc-input ${stopFlow}`} type="number" min={0} style={{ width: 64 }} value={member.homeHeight} onChange={(e) => update({ homeHeight: Math.max(0, Number(e.target.value) || 0) })} />
          </span>
        } />
        <div className="nc-hint">{t('cast.homeHint')}</div>
        </div>
      </div>
    </Dialog>
  );
};
