'use client';
import React from 'react';
import type { Beat } from '@/nodes/screenwriter/beats';
import { CONTENT_KEYS, type ContentKey } from '@/contracts/types/payloads';
import { Btn, Dialog, Kv, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useNode, useStudio } from '@/store/useStudio';

/**
 * One beat of the Screenwriter, with room to edit it (USER_FLOWS §1.9).
 *
 * It used to unfold inside the node: a role, a weight, a count, a brief and a list of bound keys,
 * all inside 220 pixels, and the node grew taller than the screen. A beat is the same kind of thing
 * as a scene of a Static Script, so it is edited the same way — a line on the node, the whole of it
 * in a dialog, previous and next to walk the list without closing.
 */
const isBeatTarget = (o: { nodeId: string; data?: unknown }): o is { nodeId: string; data: { beat: number } } => typeof (o.data as { beat?: unknown } | undefined)?.beat === 'number';

export const BeatEditorDialog: React.FC = () => {
  const t = useT();
  const overlay = useStudio((s) => s.overlay);
  const setOverlay = useStudio((s) => s.setOverlay);
  // One overlay serves the whole Studio; this dialog answers only when it is a Screenwriter's beat.
  const target = React.useMemo(() => (overlay && isBeatTarget(overlay) ? { nodeId: overlay.nodeId, index: overlay.data.beat } : null), [overlay]);
  const setParams = useStudio((s) => s.setParams);
  const node = useNode(target?.nodeId ?? '');
  const beats = React.useMemo(() => (node?.params as { beats?: Beat[] } | undefined)?.beats ?? [], [node]);
  const index = target?.index ?? 0;
  const beat = beats[index];
  const close = () => setOverlay(null);
  const go = (i: number) => { if (i >= 0 && i < beats.length) setOverlay({ nodeId: target!.nodeId, data: { beat: i } }); };
  const update = (patch: Partial<Beat>) => setParams(target!.nodeId, { beats: beats.map((b, j) => (j === index ? { ...b, ...patch } : b)) });
  const bind = (key: ContentKey, factKey: string | null) => {
    const next = { ...beat!.factBindings };
    if (factKey === null) delete next[key];
    else next[key] = factKey;
    update({ factBindings: next });
  };
  const remove = () => {
    setParams(target!.nodeId, { beats: beats.filter((_, j) => j !== index) });
    setOverlay(null);
  };

  React.useEffect(() => {
    // The node went away, or the beat did: nothing left to edit.
    if (target && (!node || !beats[index])) setOverlay(null);
  }, [target, node, beats, index, setOverlay]);
  if (!target || !beat) return null;

  const bound = Object.entries(beat.factBindings ?? {}) as [ContentKey, string][];
  const unbound = CONTENT_KEYS.filter((k) => !(k in (beat.factBindings ?? {})));

  return (
    <Dialog
      width="min(760px, 92vw)"
      height="min(640px, 88vh)"
      icon={<Icon.doc size={14} />}
      title={<span style={{ fontWeight: 400 }}>{t('screenwriter.beatOf', { i: index + 1, n: beats.length })}</span>}
      titleExtra={<>
        <input className={`nc-input ${stopFlow}`} style={{ width: 160 }} value={beat.role} title={t('screenwriter.role')} onChange={(e) => update({ role: e.target.value })} />
        <span className="nc-k">{t('node.weight')}</span>
        <input className={`nc-input ${stopFlow}`} style={{ width: 56 }} type="number" min={0.1} step={0.5} value={beat.weight} title={t('node.weight')} onChange={(e) => update({ weight: Number(e.target.value) || 1 })} />
      </>}
      onClose={close}
      closeTitle={t('script.done')}
      onKey={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(index + (e.key === 'ArrowLeft' ? -1 : 1)); } }}
      footer={<>
        <Btn small disabled={index === 0} onClick={() => go(index - 1)}>‹ {t('script.prev')}</Btn>
        <Btn small disabled={index >= beats.length - 1} onClick={() => go(index + 1)}>{t('script.next')} ›</Btn>
        <Btn small disabled={beats.length <= 1} onClick={remove}><Icon.trash size={10} /> {t('screenwriter.beatRemove')}</Btn>
        <div style={{ flex: 1 }} />
        <Btn primary onClick={close}>{t('script.done')}</Btn>
      </>}
    >
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: 12, overflowY: 'auto' }}>
        <div className="nc-k">{t('screenwriter.beatBrief')}</div>
        <textarea className={`nc-textarea ${stopFlow}`} style={{ minHeight: 120, resize: 'none', fontSize: 'var(--fs-label)', lineHeight: 1.6 }} placeholder={t('screenwriter.beatBrief')} value={beat.brief} onChange={(e) => update({ brief: e.target.value })} autoFocus />

        <Kv k={t('screenwriter.count')} v={
          <input className={`nc-input ${stopFlow}`} style={{ width: 64 }} type="number" min={1} max={12} step={1} value={beat.count} onChange={(e) => update({ count: Math.max(1, Math.min(12, Math.round(Number(e.target.value) || 1))) })} />
        } />

        {/* Naming a list turns the beat into one scene per item, and its bindings into fields of that item. */}
        <Kv k={t('screenwriter.overListLabel')} v={
          <input className={`nc-input ${stopFlow}`} style={{ width: 220 }} placeholder={t('screenwriter.overListNone')} title={t('screenwriter.overListHint')} value={beat.factList ?? ''} onChange={(e) => update({ factList: e.target.value.trim() || undefined })} />
        } />

        <div className="nc-k" style={{ marginTop: 4 }}>{t('screenwriter.bind')}</div>
        {bound.map(([key, factKey]) => (
          <Kv key={key} k={t(`content.${key}`)} v={
            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input className={`nc-input ${stopFlow}`} style={{ width: 220 }} title={beat.factList ? t('screenwriter.bindField', { key: beat.factList }) : t('screenwriter.bind')} value={factKey} onChange={(e) => bind(key, e.target.value)} />
              <button className={`nc-chip ${stopFlow}`} onClick={() => bind(key, null)} title={t('screenwriter.bindNone')}><Icon.x size={9} /></button>
            </span>
          } />
        ))}
        {unbound.length > 0 && (
          <select className={`nc-select ${stopFlow}`} style={{ alignSelf: 'flex-start' }} value="" title={t('screenwriter.bind')} onChange={(e) => { if (e.target.value) bind(e.target.value as ContentKey, e.target.value); }}>
            <option value="">{t('screenwriter.bindAdd')}</option>
            {unbound.map((k) => <option key={k} value={k}>{t(`content.${k}`)}</option>)}
          </select>
        )}
      </div>
    </Dialog>
  );
};
