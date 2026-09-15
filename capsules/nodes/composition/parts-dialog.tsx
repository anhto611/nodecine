'use client';
import React from 'react';
import { Btn, Dialog, useT } from '@/capsules/sdk/ui';
import { useHost, useNode, useOutputPayload, useOverlay, useParams } from '@/capsules/sdk/host';
import type { Composition } from '@/contracts/types/composition';
import type { PartPreview } from './preview.server';
import { kindOf, mountSnippet, nameOf, PART_NAME, pathFor, readPart, roleOf, ROLES, scaffoldPart, storyboardSnippet, type Kind, type Project, type Role } from './parts';
import { frameBox, Player, Thumbnail } from './thumbnail';

/** What the dialog opens on: the kind of part it lists. */
export type PartsDialogData = { kind: Kind; path?: string };

/** The project's blocks and components as a wall of pictures: open one to watch it large and edit it. */
export const PartsDialog: React.FC = () => {
  const t = useT();
  const { action } = useHost();
  const overlay = useOverlay();
  const nodeId = overlay.current?.nodeId ?? '';
  const node = useNode(nodeId);
  const [p, set] = useParams<Project>(nodeId);
  const out = useOutputPayload<Composition>(nodeId, 'composition');
  const [kind, setKind] = React.useState<Kind>((overlay.current?.data as PartsDialogData | undefined)?.kind ?? 'block');
  const [role, setRole] = React.useState<Role | null>(null);
  const [query, setQuery] = React.useState('');
  const wanted = (overlay.current?.data as PartsDialogData | undefined)?.path;
  const [openPath, setOpenPath] = React.useState<string | null>(wanted ?? null);
  const [big, setBig] = React.useState<PartPreview | null>(null);
  const [bigError, setBigError] = React.useState<string | null>(null);
  const [newName, setNewName] = React.useState('');
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  // Opened on one part from the node: its picture is fetched once the dialog is on screen.
  React.useEffect(() => {
    if (!wanted || (p.files ?? {})[wanted] === undefined) return;
    setBig(null); setBigError(null);
    action<PartPreview>('composition/preview-part', [{ files: p.files ?? {}, media: p.media ?? {}, engine: out?.engine }, wanted])
      .then(setBig, (e: unknown) => setBigError(e instanceof Error ? e.message : String(e)));
    // Once, for the part the node opened on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

  if (!overlay.current || node?.type !== 'composition') return null;

  const project: Project = { files: p.files ?? {}, media: p.media ?? {} };
  const frame = { width: out?.width ?? 1080, height: out?.height ?? 1920 };
  const q = query.trim().toLowerCase();
  const ofKind = Object.keys(project.files).filter((f) => kindOf(f) === kind).sort();
  const roles: Record<string, Role> = Object.fromEntries(ofKind.map((f) => [f, roleOf(project.files, f)]));
  const paths = ofKind.filter((f) => (!q || f.toLowerCase().includes(q)) && (!role || roles[f] === role));

  const watch = async (path: string, files = project.files) => {
    setBig(null); setBigError(null);
    try { setBig(await action<PartPreview>('composition/preview-part', [{ files, media: project.media, engine: out?.engine }, path])); }
    catch (e) { setBigError(e instanceof Error ? e.message : String(e)); }
  };

  const close = () => { setOpenPath(null); setBig(null); };

  const openPart = (path: string, files = project.files) => {
    setOpenPath(path);
    setMessage(null);
    void watch(path, files);
  };

  const create = () => {
    const name = newName.trim();
    const path = pathFor(kind, name);
    if (!PART_NAME.test(name) || project.files[path] !== undefined) { setMessage({ ok: false, text: t('node.compositionBadName') }); return; }
    const files = { ...project.files, [path]: scaffoldPart(kind, name, frame, role ?? undefined) };
    set({ files });
    setNewName('');
    openPart(path, files);
  };

  const remove = (path: string) => {
    const { [path]: _gone, ...rest } = project.files;
    set({ files: rest });
    close();
  };

  const copy = (text: string, done: string) => void navigator.clipboard?.writeText(text).then(() => setMessage({ ok: true, text: done }));

  return (
    <Dialog
      width="min(1240px, 95vw)"
      height="90vh"
      title={t('node.compositionPartsTitle')}
      onClose={overlay.close}
      titleExtra={
        <span style={{ display: 'flex', gap: 4, marginLeft: 12, alignItems: 'center' }}>
          {(['block', 'component'] as const).map((k) => (
            <button key={k} className={`nc-chip ${k === kind ? 'on' : ''}`} onClick={() => { setKind(k); setRole(null); close(); }}>{t(`node.compositionKind.${k}`)}</button>
          ))}
          <input className="nc-input" style={{ width: 200, marginLeft: 8 }} placeholder={t('node.compositionSearch')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </span>
      }
    >
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ color: 'var(--tx-3)', lineHeight: 1.5 }}>{t(`node.compositionKindHint.${kind}`)}</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button className={`nc-chip ${role === null ? 'on' : ''}`} onClick={() => setRole(null)}>{t('node.compositionRoleAll')} · {ofKind.length}</button>
            {ROLES[kind].map((r) => (
              <button key={r} className={`nc-chip ${role === r ? 'on' : ''}`} title={t(`node.compositionRoleHint.${r}`)} onClick={() => setRole(r)}>
                {t(`node.compositionRole.${r}`)} · {ofKind.filter((f) => roles[f] === r).length}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="nc-input" style={{ width: 260 }} placeholder={t('node.compositionNewName')} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
            <Btn primary onClick={create}>{t(`node.compositionNew.${kind}`)}{role ? ` · ${t(`node.compositionRole.${role}`)}` : ''}</Btn>
          </div>
          {paths.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
              {paths.map((path) => (
                <Thumbnail key={path} path={path} project={project} engine={out?.engine} selected={path === openPath} onOpen={() => openPart(path)} height="260px">
                  <div style={{ color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(path)}</div>
                  <div style={{ color: 'var(--tx-3)', fontSize: 'var(--fs-hint)' }}>
                    {t(`node.compositionRole.${roleOf(project.files, path)}`)} · {readPart(project.files[path] ?? '').variables.length} {t('node.compositionVariables')}
                  </div>
                </Thumbnail>
              ))}
            </div>
          ) : <div style={{ color: 'var(--tx-3)' }}>{t('node.compositionNone')}</div>}
        </div>

        {openPath && project.files[openPath] !== undefined && (
          <div style={{ width: 520, flex: 'none', borderLeft: '1px solid var(--line)', padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <b style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{openPath}</b>
              <button className="nc-chip" onClick={close}>×</button>
            </div>
            <div style={{ ...frameBox(big ?? frame, '70vh'), flex: 'none' }}>
              {big ? <Player key={big.url} preview={big} loop /> : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, textAlign: 'center', color: bigError ? 'var(--err)' : 'var(--tx-3)', overflowWrap: 'anywhere' }}>{bigError ?? '…'}</div>
              )}
            </div>
            <div style={{ color: 'var(--tx-3)', fontSize: 'var(--fs-hint)', lineHeight: 1.6 }}>
              {t(`node.compositionRole.${roleOf(project.files, openPath)}`)} · {t('node.compositionVariables')}: {readPart(project.files[openPath]).variables.map((v) => `${v.id} (${v.type})`).join(', ') || t('node.compositionNone')}
            </div>
            <textarea
              className="nc-textarea"
              style={{ fontFamily: 'ui-monospace, Menlo, monospace', minHeight: 260, flex: 1 }}
              value={project.files[openPath]}
              onChange={(e) => set({ files: { ...project.files, [openPath]: e.target.value } })}
              spellCheck={false}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn primary onClick={() => void watch(openPath)}>{t('node.compositionReplay')}</Btn>
              {kind === 'block'
                ? <Btn onClick={() => copy(storyboardSnippet(nameOf(openPath), project.files[openPath] ?? ''), t('node.compositionCopiedFrame'))}>{t('node.compositionCopyFrame')}</Btn>
                : <Btn onClick={() => copy(mountSnippet(openPath, project.files[openPath] ?? '', frame), t('node.compositionCopied'))}>{t('node.compositionCopyMount')}</Btn>}
              <Btn danger onClick={() => remove(openPath)}>{t('node.compositionRemoveFile')}</Btn>
            </div>
            {message && <div style={{ fontSize: 'var(--fs-hint)', color: message.ok ? 'var(--ok)' : 'var(--err)', overflowWrap: 'anywhere' }}>{message.text}</div>}
          </div>
        )}
        {!openPath && message && <div style={{ position: 'absolute', bottom: 12, left: 14, fontSize: 'var(--fs-hint)', color: message.ok ? 'var(--ok)' : 'var(--err)' }}>{message.text}</div>}
      </div>
    </Dialog>
  );
};
