'use client';
import React from 'react';
import { useStudio } from '@/store/useStudio';
import { workflowsApi, type WorkflowSummary } from '@/lib/workflows.client';
import { localized } from '@/core/engine/document';
import { Icon } from '@/capsules/sdk/icons';
import { Btn, useT } from '@/capsules/sdk/ui';

/**
 * The user's workflow files, like ComfyUI's Workflows sidebar: what is open, and
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
  // One line for whatever the last action could not do: import, open, download, delete. A file that will
  // not open used to do nothing at all when clicked, which reads as the app ignoring the click.
  const [notice, setNotice] = React.useState<{ what: 'import' | 'open' | 'download' | 'delete' | 'migrated'; why: string } | null>(null);
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
    let def: Awaited<ReturnType<typeof workflowsApi.read>>;
    try {
      def = await workflowsApi.read(id);
    } catch (e) {
      setNotice({ what: 'download', why: e instanceof Error ? e.message : String(e) });
      return;
    }
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
          const why = /\.mp4$/i.test(f.name) || f.type === 'video/mp4' ? await importVideo(f) : await importWorkflow(await f.text());
          setNotice(why ? { what: 'import', why } : null);
        }} />
      </div>
      {notice && (
        <div style={{ padding: '6px 12px', fontSize: 'var(--fs-body)', color: notice.what === 'migrated' ? 'var(--warn)' : 'var(--err)', borderBottom: '1px solid var(--line)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <span style={{ flex: 1, minWidth: 0 }}>{t(`workflows.${notice.what}Bad`, { why: notice.why })}</span>
          <button className="nc-chip" style={{ border: 0, flex: 'none' }} onClick={() => setNotice(null)}><Icon.x size={11} /></button>
        </div>
      )}
      <div style={{ padding: '6px 12px', fontSize: 'var(--fs-hint)', color: 'var(--tx-3)', borderBottom: '1px solid var(--line)' }}>{t('workflows.where')}</div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {files === null && <div style={{ padding: '6px 12px', color: 'var(--tx-3)', fontSize: 'var(--fs-body)' }}>…</div>}
        {files?.filter((file) => file.category !== 'template').length === 0 && <div style={{ padding: '6px 12px', color: 'var(--tx-3)', fontSize: 'var(--fs-body)' }}>{t('workflows.empty')}</div>}
        {files?.filter((file) => file.category !== 'template').map((f) => {
          const isOpen = tabs.some((x) => x.fileId === f.id);
          return (
            <div key={f.id} className={`nc-wf ${isOpen ? 'open' : ''}`} onClick={async () => {
              if (renaming || confirm === f.id) return;
              const outcome = await open(f.id);
              setNotice(outcome ? { what: outcome.kind === 'failed' ? 'open' : 'migrated', why: outcome.why } : null);
            }}>
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
                    <button className="nc-chip on" onClick={() => {
                      void remove(f.id).then(() => setNotice(null)).catch((e) => setNotice({ what: 'delete', why: e instanceof Error ? e.message : String(e) }));
                      setConfirm(null);
                    }}>{t('workflows.delete')}</button>
                    <button className="nc-chip" onClick={() => setConfirm(null)}>{t('tabs.keep')}</button>
                  </div>
                ) : (
                  // Only the buttons keep a click to themselves: the space around them opens the workflow like the rest of the row.
                  <div className="nc-wf-actions">
                    <button className="nc-chip" onClick={(e) => { e.stopPropagation(); setRenaming({ id: f.id, name: localized(f.name, locale, f.id) }); }}>{t('workflows.rename')}</button>
                    <button className="nc-chip" onClick={(e) => { e.stopPropagation(); void download(f.id); }}>{t('workflows.download')}</button>
                    <button className="nc-chip" onClick={(e) => { e.stopPropagation(); setConfirm(f.id); }}>{t('workflows.delete')}</button>
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
