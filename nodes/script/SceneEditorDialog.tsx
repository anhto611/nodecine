'use client';
import React from 'react';
import type { SceneContent } from '@/core/types/payloads';
import { Btn, Dialog, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useNode, useStudio } from '@/store/useStudio';
import { ContentEditor } from '@/components/node-runtime/content-editor';

type SceneRow = { role: string; weight: number; narration: string; content: SceneContent };

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
  // The store holds one overlay for the whole Studio; this dialog answers only when it is a Static Script's.
  const target = overlay && isSceneTarget(overlay) ? { nodeId: overlay.nodeId, index: overlay.data.index } : null;
  const open = (t: { nodeId: string; index: number } | null) => setOverlay(t ? { nodeId: t.nodeId, data: { index: t.index } } : null);
  const setParams = useStudio((s) => s.setParams);
  const node = useNode(target?.nodeId ?? '');
  const scenes = ((node?.params as { scenes?: SceneRow[] } | undefined)?.scenes ?? []);
  const index = target?.index ?? 0;
  const scene = scenes[index];
  const close = () => open(null);
  const go = (i: number) => { if (i >= 0 && i < scenes.length) open({ nodeId: target!.nodeId, index: i }); };
  const update = (patch: Partial<SceneRow>) => setParams(target!.nodeId, { scenes: scenes.map((s, j) => (j === index ? { ...s, ...patch } : s)) });

  React.useEffect(() => {
    // The node went away, or the scene did: nothing left to edit.
    if (target && (!node || !scenes[index])) open(null);
  }, [target, node, scenes, index, open]);
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
          </div>
        </div>
    </Dialog>
  );
};
