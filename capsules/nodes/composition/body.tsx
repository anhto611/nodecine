'use client';
import React from 'react';
import { Btn, Kv, useT, stopFlow } from '@/capsules/sdk/ui';
import { useOutputPayload, useOverlay, useParams, type BodyProps } from '@/capsules/sdk/host';
import { COMPOSITION_ENTRY, ProjectPathSchema, type Composition } from '@/contracts/types/composition';
import { kindOf, type Kind, type Project } from './parts';
import type { PartsDialogData } from './parts-dialog';

export { PartsDialog } from './parts-dialog';

/**
 * A HyperFrames project on the canvas: its files to read and edit, and a count of its blocks and
 * components with the way in to the wall of pictures where they are written and watched, which
 * opens above the canvas.
 */
export const CompositionBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const overlay = useOverlay();
  const [p, set] = useParams<Project>(nodeId);
  const out = useOutputPayload<Composition>(nodeId, 'composition');
  const files = React.useMemo(() => p.files ?? {}, [p.files]);
  const media = p.media ?? {};
  const names = Object.keys(files).sort((a, b) => (a === COMPOSITION_ENTRY ? -1 : b === COMPOSITION_ENTRY ? 1 : a.localeCompare(b)));
  const [open, setOpen] = React.useState(COMPOSITION_ENTRY);
  const current = files[open] !== undefined ? open : COMPOSITION_ENTRY;
  const [newFile, setNewFile] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const addFile = () => {
    const parsed = ProjectPathSchema.safeParse(newFile.trim());
    if (!parsed.success || files[parsed.data] !== undefined) { setError(t('node.compositionBadPath')); return; }
    set({ files: { ...files, [parsed.data]: '' } });
    setOpen(parsed.data);
    setNewFile('');
    setError(null);
  };

  const removeFile = (file: string) => {
    const { [file]: _gone, ...rest } = files;
    set({ files: rest });
    setOpen(COMPOSITION_ENTRY);
  };

  const count = (kind: Kind) => names.filter((n) => kindOf(n) === kind).length;

  return (
    <div className={stopFlow} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {(['block', 'component'] as const).map((kind) => (
          <Btn key={kind} small style={{ flex: 1, justifyContent: 'center' }} onClick={() => overlay.open(nodeId, { kind } satisfies PartsDialogData)}>
            {t(`node.compositionKind.${kind}`)} · {count(kind)}
          </Btn>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {names.map((n) => <button key={n} className={`nc-chip ${n === current ? 'on' : ''}`} onClick={() => setOpen(n)} title={n}>{n}</button>)}
      </div>
      <textarea
        className="nc-textarea"
        style={{ fontFamily: 'ui-monospace, Menlo, monospace', minHeight: 160 }}
        value={files[current] ?? ''}
        onChange={(e) => set({ files: { ...files, [current]: e.target.value } })}
        spellCheck={false}
      />
      <div style={{ display: 'flex', gap: 4 }}>
        <input className="nc-input" style={{ flex: 1 }} placeholder="compositions/my-block.html" value={newFile} onChange={(e) => setNewFile(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addFile(); }} />
        <Btn small onClick={addFile}>{t('node.compositionAddFile')}</Btn>
        {current !== COMPOSITION_ENTRY && <Btn small danger onClick={() => removeFile(current)}>{t('node.compositionRemoveFile')}</Btn>}
      </div>
      {error && <div style={{ fontSize: 'var(--fs-hint)', color: 'var(--err)' }}>{error}</div>}
      <Kv k={t('node.compositionMedia')} v={Object.keys(media).length ? String(Object.keys(media).length) : t('node.compositionNone')} dim />
      {out && <Kv k={t('node.compositionSize')} v={`${out.width}×${out.height} · ${out.fps}fps`} />}
    </div>
  );
};
