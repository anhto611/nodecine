'use client';
import React from 'react';
import type { SceneContent } from '@/core/types/payloads';
import { Btn, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useNode, useStudio } from '@/store/useStudio';
import { ContentEditor } from './content-editor';

type SceneRow = { role: string; weight: number; narration: string; content: SceneContent };

/**
 * One scene of a Static Script, with room to edit it (USER_FLOWS §1.9): the narration on the left,
 * what is on screen on the right, and previous/next to walk the script without closing. Edits go
 * straight to the node's parameters, the same as typing in the node, so undo and dirty marks work
 * the same and there is nothing to save.
 */
export const SceneEditorDialog: React.FC = () => {
  const t = useT();
  const target = useStudio((s) => s.sceneEditor);
  const open = useStudio((s) => s.setSceneEditor);
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
    <div className="nc-modal-bg" onClick={close}>
      <div
        className="nc-modal"
        style={{ width: 'min(1100px, 92vw)', height: 'min(720px, 90vh)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDownCapture={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
          const inField = !!(e.target as HTMLElement | null)?.closest?.('input, textarea, select');
          // Never let a Delete reach the canvas behind the modal, where it would remove the node.
          if (!inField && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); e.stopPropagation(); }
          if (!inField && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); e.stopPropagation(); go(index + (e.key === 'ArrowLeft' ? -1 : 1)); }
        }}
      >
        <div style={{ height: 46, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ color: 'var(--accent-2)' }}><Icon.doc size={14} /></span>
          <span style={{ fontSize: 'var(--fs-title)' }}>{t('script.scene', { i: index + 1, n: scenes.length })}</span>
          <input className={`nc-input ${stopFlow}`} style={{ width: 160 }} value={scene.role} title={t('screenwriter.role')} onChange={(e) => update({ role: e.target.value })} />
          <span className="nc-k">{t('node.weight')}</span>
          <input className={`nc-input ${stopFlow}`} style={{ width: 56 }} type="number" min={0.1} step={0.5} value={scene.weight} title={t('node.weight')} onChange={(e) => update({ weight: Number(e.target.value) || 1 })} />
          <div style={{ flex: 1 }} />
          <button className="nc-chip" style={{ border: 0 }} onClick={close} title={t('script.done')}><Icon.x /></button>
        </div>
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
        <div style={{ borderTop: '1px solid var(--line)', padding: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Btn small disabled={index === 0} onClick={() => go(index - 1)}>‹ {t('script.prev')}</Btn>
          <Btn small disabled={index >= scenes.length - 1} onClick={() => go(index + 1)}>{t('script.next')} ›</Btn>
          <div style={{ flex: 1 }} />
          <Btn primary onClick={close}>{t('script.done')}</Btn>
        </div>
      </div>
    </div>
  );
};
