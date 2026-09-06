'use client';
import React from 'react';
import { useStudio } from '@/store/useStudio';
import { Icon } from './icons';
import { Btn, useT } from './ui';

/**
 * The open workflows, ComfyUI-style, under the header: one tab each with an unsaved mark, a close
 * button that asks once when the tab is dirty, a + for a new draft, and Save / Save as on the right.
 * Saving a draft asks for a name inline; nothing here opens a dialog.
 */
export const WorkflowTabs: React.FC = () => {
  const t = useT();
  const tabs = useStudio((s) => s.tabs);
  const active = useStudio((s) => s.activeTab);
  const activate = useStudio((s) => s.activateTab);
  const close = useStudio((s) => s.closeTab);
  const create = useStudio((s) => s.newWorkflow);
  const save = useStudio((s) => s.saveWorkflow);
  const saveAs = useStudio((s) => s.saveWorkflowAs);
  const setPanel = useStudio((s) => s.setPanel);
  const [confirmClose, setConfirmClose] = React.useState<string | null>(null);
  const [naming, setNaming] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const current = tabs.find((x) => x.key === active);

  const doSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await save();
      if (r === 'needs-name') setNaming(current?.name ?? '');
    } finally {
      setBusy(false);
    }
  };
  const doSaveAs = async () => {
    if (!naming?.trim() || busy) return;
    setBusy(true);
    try {
      await saveAs(naming);
      setNaming(null);
    } finally {
      setBusy(false);
    }
  };

  // Ctrl/Cmd+S saves the active tab, Shift for Save as; Ctrl/Cmd+B bypasses the selected node.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) setNaming(useStudio.getState().projectName);
        else void doSave();
      }
      // Ctrl/Cmd+B bypasses the selected node, like ComfyUI.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        const { selectedNodeId, toggleBypass } = useStudio.getState();
        if (selectedNodeId) {
          e.preventDefault();
          toggleBypass(selectedNodeId);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.key]);

  return (
    <div className="nc-tabs">
      <div className="nc-tabs-list">
        {tabs.map((tab) => {
          const on = tab.key === active;
          const asking = confirmClose === tab.key;
          return (
            <div key={tab.key} className={`nc-tab ${on ? 'on' : ''}`} onClick={() => activate(tab.key)} title={tab.fileId ? `${tab.name} · ${tab.fileId}.json` : t('tabs.draft')}>
              <span className="nc-tab-name">{tab.name || t('tabs.untitled')}</span>
              {tab.dirty && <span className="nc-tab-dot" title={t('tabs.unsaved')}>•</span>}
              {asking ? (
                <span className="nc-tab-ask" onClick={(e) => e.stopPropagation()}>
                  <button className="nc-chip on" onClick={() => { close(tab.key); setConfirmClose(null); }}>{t('tabs.discard')}</button>
                  <button className="nc-chip" onClick={() => setConfirmClose(null)}>{t('tabs.keep')}</button>
                </span>
              ) : (
                <button className="nc-tab-x" title={t('tabs.close')} onClick={(e) => { e.stopPropagation(); if (tab.dirty) setConfirmClose(tab.key); else close(tab.key); }}><Icon.x size={9} /></button>
              )}
            </div>
          );
        })}
        <button className="nc-tab-add" title={t('tabs.new')} onClick={create}><Icon.plus size={11} /></button>
      </div>
      <div className="nc-tabs-actions">
        {naming !== null ? (
          <>
            <input className="nc-input" style={{ width: 220, height: 24 }} autoFocus placeholder={t('tabs.saveName')} value={naming} onChange={(e) => setNaming(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void doSaveAs(); if (e.key === 'Escape') setNaming(null); }} />
            <Btn small primary disabled={!naming.trim() || busy} onClick={() => void doSaveAs()}>{t('tabs.saveDo')}</Btn>
            <Btn small onClick={() => setNaming(null)}>{t('templates.cancel')}</Btn>
          </>
        ) : (
          <>
            <Btn small onClick={() => setPanel('workflows')} title={`${t('rail.workflows')} (W)`}><Icon.doc size={10} /> {t('rail.workflows')}</Btn>
            <Btn small disabled={busy || (!current?.dirty && !!current?.fileId)} onClick={() => void doSave()} title="Ctrl+S">{t('tabs.save')}</Btn>
            <Btn small disabled={busy} onClick={() => setNaming(current?.name ?? '')} title="Ctrl+Shift+S">{t('tabs.saveAs')}</Btn>
          </>
        )}
      </div>
    </div>
  );
};
