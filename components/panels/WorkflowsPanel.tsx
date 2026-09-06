'use client';
import React from 'react';
import { useStudio } from '@/store/useStudio';
import { workflowsApi, type WorkflowSummary } from '@/lib/workflows.client';
import { localized } from '@/core/templates/registry';
import { Icon } from '../icons';
import { Btn, useT } from '../ui';

/**
 * The user's workflow files (USER_FLOWS §1.6), like ComfyUI's Workflows sidebar: what is open, and
 * every file on disk with open, rename, download and delete. The list is read from the server each
 * time it is shown and after any save, so it never disagrees with the directory.
 */
export const WorkflowsPanel: React.FC = () => {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const tabs = useStudio((s) => s.tabs);
  const tick = useStudio((s) => s.workflowsTick);
  const setPanel = useStudio((s) => s.setPanel);
  const create = useStudio((s) => s.newWorkflow);
  const open = useStudio((s) => s.openWorkflow);
  const rename = useStudio((s) => s.renameWorkflow);
  const remove = useStudio((s) => s.deleteWorkflow);
  const importWorkflow = useStudio((s) => s.importWorkflow);
  const importVideo = useStudio((s) => s.importWorkflowVideo);
  const [importError, setImportError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [files, setFiles] = React.useState<WorkflowSummary[] | null>(null);
  const [renaming, setRenaming] = React.useState<{ id: string; name: string } | null>(null);
  const [confirm, setConfirm] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    void workflowsApi.list().then((l) => { if (alive) setFiles(l); }).catch(() => { if (alive) setFiles([]); });
    return () => { alive = false; };
  }, [tick]);

  const download = async (id: string) => {
    const def = await workflowsApi.read(id).catch(() => null);
    if (!def) return;
    const blob = new Blob([JSON.stringify(def, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${id}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <aside className="nc-panel">
      <div className="nc-pn-h">{t('workflows.title')}<button className="nc-chip" style={{ marginLeft: 'auto', border: 0 }} onClick={() => setPanel('workflows')}><Icon.x size={12} /></button></div>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Btn small onClick={create}><Icon.plus size={10} /> {t('tabs.new')}</Btn>
        <Btn small onClick={() => fileRef.current?.click()}><Icon.down size={10} /> {t('workflows.import')}</Btn>
        <input ref={fileRef} type="file" accept="application/json,.json,video/mp4,.mp4" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setImportError(/\.mp4$/i.test(f.name) || f.type === 'video/mp4' ? await importVideo(f) : await importWorkflow(await f.text()));
        }} />
      </div>
      {importError && <div style={{ padding: '6px 12px', fontSize: 'var(--fs-body)', color: 'var(--err)', borderBottom: '1px solid var(--line)' }}>{t('workflows.importBad', { why: importError })}</div>}
      <div style={{ padding: '6px 12px', fontSize: 'var(--fs-hint)', color: 'var(--tx-3)', borderBottom: '1px solid var(--line)' }}>{t('workflows.where')}</div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {files === null && <div style={{ padding: '6px 12px', color: 'var(--tx-3)', fontSize: 'var(--fs-body)' }}>…</div>}
        {files?.length === 0 && <div style={{ padding: '6px 12px', color: 'var(--tx-3)', fontSize: 'var(--fs-body)' }}>{t('workflows.empty')}</div>}
        {files?.map((f) => {
          const isOpen = tabs.some((x) => x.fileId === f.id);
          return (
            <div key={f.id} className={`nc-wf ${isOpen ? 'open' : ''}`} onClick={() => { if (!renaming && confirm !== f.id) void open(f.id); }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                {renaming?.id === f.id ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <input className="nc-input" style={{ flex: 1, minWidth: 0 }} autoFocus value={renaming.name} onChange={(e) => setRenaming({ id: f.id, name: e.target.value })} onKeyDown={async (e) => { if (e.key === 'Enter') { await rename(f.id, renaming.name); setRenaming(null); } if (e.key === 'Escape') setRenaming(null); }} />
                    <Btn small primary style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }} onClick={async () => { await rename(f.id, renaming.name); setRenaming(null); }}>{t('workflows.renameDo')}</Btn>
                  </div>
                ) : (
                  <>
                    <div className="nc-wf-name">{localized(f.name, locale, f.id)}</div>
                    <div className="nc-wf-meta">{t('workflows.meta', { n: f.nodes, at: new Date(f.updatedAt).toLocaleString() })}</div>
                  </>
                )}
                {renaming?.id === f.id ? (
                  <div className="nc-wf-actions" onClick={(e) => e.stopPropagation()}>
                    <span style={{ color: 'var(--tx-3)' }}>{t('workflows.renameHint')}</span>
                    <button className="nc-chip" onClick={() => setRenaming(null)}>{t('workflows.renameCancel')}</button>
                  </div>
                ) : confirm === f.id ? (
                  <div className="nc-wf-actions" onClick={(e) => e.stopPropagation()}>
                    <span style={{ color: 'var(--err)' }}>{t('workflows.deleteAsk')}</span>
                    <button className="nc-chip on" onClick={() => { void remove(f.id); setConfirm(null); }}>{t('workflows.delete')}</button>
                    <button className="nc-chip" onClick={() => setConfirm(null)}>{t('tabs.keep')}</button>
                  </div>
                ) : (
                  <div className="nc-wf-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="nc-chip" onClick={() => setRenaming({ id: f.id, name: localized(f.name, locale, f.id) })}>{t('workflows.rename')}</button>
                    <button className="nc-chip" onClick={() => void download(f.id)}>{t('workflows.download')}</button>
                    <button className="nc-chip" onClick={() => setConfirm(f.id)}>{t('workflows.delete')}</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
