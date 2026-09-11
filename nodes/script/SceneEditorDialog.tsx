'use client';
import React from 'react';
import type { SceneContent, Stage, Transition } from '@/core/types/payloads';
import { listTransitions } from '@/core/visual/transitions';
import { Btn, Dialog, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useNode, useStudio } from '@/store/useStudio';
import { ContentEditor } from '@/components/node-runtime/content-editor';

type SceneRow = { role: string; weight: number; narration: string; content: SceneContent; stage?: Stage; transitionAfter?: Transition };

/**
 * One scene of a Static Script, with room to edit it (USER_FLOWS §1.9): the narration on the left,
 * what is on screen on the right, and previous/next to walk the script without closing. Edits go
 * straight to the node's parameters, the same as typing in the node, so undo and dirty marks work
 * the same and there is nothing to save.
 */
const isSceneTarget = (o: { nodeId: string; data?: unknown }): o is { nodeId: string; data: { index: number } } => typeof (o.data as { index?: unknown } | undefined)?.index === 'number';

export const SceneEditorDialog: React.FC = () => {
  const t = useT();
  const overlay = useStudio((s) => s.overlay);
  const setOverlay = useStudio((s) => s.setOverlay);
  // The store holds one overlay for the whole Studio; this dialog answers only when it is a Static
  // Script's. Both of these are held still across renders so the effect below runs when the scene
  // being edited actually changes, not on every keystroke in it.
  const target = React.useMemo(() => (overlay && isSceneTarget(overlay) ? { nodeId: overlay.nodeId, index: overlay.data.index } : null), [overlay]);
  const open = (t: { nodeId: string; index: number } | null) => setOverlay(t ? { nodeId: t.nodeId, data: { index: t.index } } : null);
  const setParams = useStudio((s) => s.setParams);
  const node = useNode(target?.nodeId ?? '');
  const scenes = React.useMemo(() => (node?.params as { scenes?: SceneRow[] } | undefined)?.scenes ?? [], [node]);
  const index = target?.index ?? 0;
  const scene = scenes[index];
  const close = () => open(null);
  const go = (i: number) => { if (i >= 0 && i < scenes.length) open({ nodeId: target!.nodeId, index: i }); };
  const update = (patch: Partial<SceneRow>) => setParams(target!.nodeId, { scenes: scenes.map((s, j) => (j === index ? { ...s, ...patch } : s)) });

  React.useEffect(() => {
    // The node went away, or the scene did: nothing left to edit.
    if (target && (!node || !scenes[index])) setOverlay(null);
  }, [target, node, scenes, index, setOverlay]);
  if (!target || !scene) return null;

  return (
    <Dialog
      width="min(1100px, 92vw)"
      height="min(720px, 90vh)"
      icon={<Icon.doc size={14} />}
      title={<span style={{ fontWeight: 400 }}>{t('script.scene', { i: index + 1, n: scenes.length })}</span>}
      titleExtra={<>
        <input className={`nc-input ${stopFlow}`} style={{ width: 160 }} value={scene.role} title={t('screenwriter.role')} onChange={(e) => update({ role: e.target.value })} />
        <span className="nc-k">{t('node.weight')}</span>
        <input className={`nc-input ${stopFlow}`} style={{ width: 56 }} type="number" min={0.1} step={0.5} value={scene.weight} title={t('node.weight')} onChange={(e) => update({ weight: Number(e.target.value) || 1 })} />
      </>}
      onClose={close}
      closeTitle={t('script.done')}
      onKey={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(index + (e.key === 'ArrowLeft' ? -1 : 1)); } }}
      footer={<>
        <Btn small disabled={index === 0} onClick={() => go(index - 1)}>‹ {t('script.prev')}</Btn>
        <Btn small disabled={index >= scenes.length - 1} onClick={() => go(index + 1)}>{t('script.next')} ›</Btn>
        <div style={{ flex: 1 }} />
        <Btn primary onClick={close}>{t('script.done')}</Btn>
      </>}
    >
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 0 }}>
          <div style={{ flex: '0 0 38%', display: 'flex', flexDirection: 'column', gap: 6, padding: 12, borderRight: '1px solid var(--line)', minWidth: 0 }}>
            <div className="nc-k">{t('script.narration')}</div>
            <textarea className={`nc-textarea ${stopFlow}`} style={{ flex: 1, resize: 'none', fontSize: 'var(--fs-label)', lineHeight: 1.6 }} placeholder={t('node.script')} value={scene.narration ?? ''} onChange={(e) => update({ narration: e.target.value })} autoFocus />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, padding: 12, overflowY: 'auto' }}>
            <div className="nc-k">{t('script.onScreen')}</div>
            <ContentEditor content={scene.content ?? {}} onChange={(content) => update({ content })} />
            <div className="nc-k" style={{ marginTop: 8 }}>{t('script.transitionAfter')}</div>
            <TransitionAfter value={scene.transitionAfter} last={index >= scenes.length - 1} onChange={(transitionAfter) => update({ transitionAfter })} />
            <div className="nc-k" style={{ marginTop: 8 }}>{t('script.stage')}</div>
            <StageField value={scene.stage} onChange={(stage) => update({ stage })} />
          </div>
        </div>
    </Dialog>
  );
};

/** How this scene gives way to the next: the film's default, or a name from the registry with its length. Meaningless on the last scene. */
const TransitionAfter: React.FC<{ value?: Transition; last: boolean; onChange: (v: Transition | undefined) => void }> = ({ value, last, onChange }) => {
  const t = useT();
  const names = listTransitions();
  const options = value && !names.includes(value.type) ? [value.type, ...names] : names;
  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: last ? 0.5 : 1 }}>
      <select className={`nc-select ${stopFlow}`} value={value?.type ?? ''} disabled={last} onChange={(e) => onChange(e.target.value ? { type: e.target.value, seconds: value?.seconds ?? 0.4 } : undefined)}>
        <option value="">{t('script.transitionDefault')}</option>
        {options.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      {value ? <input className={`nc-input ${stopFlow}`} type="number" min={0.1} max={2} step={0.1} style={{ width: 56 }} value={value.seconds} onChange={(e) => onChange({ type: value.type, seconds: Math.min(2, Math.max(0.1, Number(e.target.value) || 0.4)) })} /> : null}
      {value ? <span className="nc-k">s</span> : null}
    </span>
  );
};

/** The free map a spanning layer reads (docs/IR_V3.md §5.2), typed as JSON; saved only while it parses to an object. */
const StageField: React.FC<{ value?: Stage; onChange: (v: Stage | undefined) => void }> = ({ value, onChange }) => {
  const t = useT();
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? (value ? JSON.stringify(value) : '');
  let invalid = false;
  if (draft !== null && draft.trim()) {
    try { const parsed: unknown = JSON.parse(draft); invalid = !parsed || typeof parsed !== 'object' || Array.isArray(parsed); } catch { invalid = true; }
  }
  const commit = (text: string) => {
    setDraft(text);
    if (!text.trim()) { onChange(undefined); return; }
    try { const parsed: unknown = JSON.parse(text); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) onChange(parsed as Stage); } catch { /* kept as typed until it parses */ }
  };
  return (
    <>
      <textarea className={`nc-textarea ${stopFlow}`} style={{ minHeight: 44, fontSize: 'var(--fs-hint)', fontFamily: 'var(--font-mono, monospace)', borderColor: invalid ? 'var(--err)' : undefined }} placeholder="{ }" value={shown} onChange={(e) => commit(e.target.value)} onBlur={() => { if (!invalid) setDraft(null); }} />
      <div className="nc-hint" style={{ color: invalid ? 'var(--err)' : undefined }}>{invalid ? t('script.stageInvalid') : t('script.stageHint')}</div>
    </>
  );
};
