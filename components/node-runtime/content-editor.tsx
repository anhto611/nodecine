'use client';
import React from 'react';
import { CONTENT_KEYS, type ContentKey, type EntryContent, type SceneContent } from '@/core/types/payloads';
import { Kv, Btn, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { uploadImage, useLibraryFile } from '@/lib/assets.client';
import { LibraryPicker, useLibrary } from '@/nodes/library-picker';

/**
 * The form for what one scene says on screen, in the content vocabulary (CORE_CONTRACTS §2.11).
 * It lives in the scene editor dialog, not in the node: two entries with pictures need more than
 * the 220px a node has, and the node shows the scene folded to a line instead.
 */
/**
 * The several things one scene shows at once: two to compare, three steps, a handful of rows.
 *
 * Each entry is the same form as the scene itself, one level down — so a person who has filled in a
 * scene already knows how to fill in an entry, and a comparison needs no new kind of editor.
 */
const EntriesEditor: React.FC<{ entries: EntryContent[]; onChange: (entries: EntryContent[]) => void }> = ({ entries, onChange }) => {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {entries.map((entry, i) => (
        <div key={i} style={{ flex: '1 1 220px', minWidth: 0, border: '1px solid var(--line)', borderRadius: 3, padding: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div className="nc-scene-row">
            <span className="nc-k" style={{ color: 'var(--accent-2)' }}>{i + 1}</span>
            <span style={{ flex: 1 }} />
            <button className={`nc-chip ${stopFlow}`} onClick={() => onChange(entries.filter((_, j) => j !== i))} title={t('common.remove')}><Icon.x size={9} /></button>
          </div>
          <ContentEditor content={entry} onChange={(c) => onChange(entries.map((e, j) => (j === i ? c : e)))} />
        </div>
      ))}
      </div>
      <Btn small className={stopFlow} onClick={() => onChange([...entries, {}])} style={{ alignSelf: 'flex-start' }}><Icon.plus size={10} /> {t('script.addEntry')}</Btn>
    </div>
  );
};

/** The scene's picture: upload one and the scene carries the asset it becomes. */
export const ImagePick: React.FC<{ url?: string; onPick: (url: string | undefined) => void }> = ({ url, onPick }) => {
  const t = useT();
  const ref = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const pick = async (f: File) => {
    setBusy(true);
    setErr(null);
    try { onPick(await uploadImage(f)); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pick(f); }} />
      {url ? <img src={url} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 3, border: '1px solid var(--line-2)', flex: 'none' }} /> : null}
      <button className={`nc-chip ${stopFlow}`} onClick={() => ref.current?.click()} disabled={busy}>{busy ? '…' : t(url ? 'content.imageSwap' : 'content.imagePick')}</button>
      {err ? <span className="nc-hint" style={{ color: 'var(--err)' }} title={err}>!</span> : null}
    </span>
  );
};

/**
 * The scene's clip: chosen by name from this machine's clips folder, then taken into the asset store
 * so the scene carries a hash the server can validate — never a path from the user's disk.
 */
const ClipPick: React.FC<{ url?: string; onPick: (url: string | undefined) => void }> = ({ url, onPick }) => {
  const t = useT();
  const { files, folder, loading } = useLibrary('clips');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const take = async (file: string) => {
    setName(file);
    if (!file) { onPick(undefined); return; }
    setBusy(true);
    setErr(null);
    try { onPick(await useLibraryFile('clips', file)); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0, flexWrap: 'wrap' }}>
      {url ? <video src={url} muted playsInline style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 3, border: '1px solid var(--line-2)', flex: 'none' }} /> : null}
      <LibraryPicker files={files} value={name} empty={busy ? '…' : t('content.clipPick')} onChange={(f) => void take(f)} />
      {!loading && !files.length && folder ? <span className="nc-hint one-line" title={folder}>{t('content.clipsEmpty')}</span> : null}
      {err ? <span className="nc-hint" style={{ color: 'var(--err)' }} title={err}>!</span> : null}
    </span>
  );
};

/** One input per content key the scene uses, and a picker to add another; points are one per line. */
export const ContentEditor: React.FC<{ content: SceneContent; onChange: (c: SceneContent) => void }> = ({ content, onChange }) => {
  const t = useT();
  const used = CONTENT_KEYS.filter((k) => k in content);
  const unused = CONTENT_KEYS.filter((k) => !(k in content));
  const setKey = (k: ContentKey, v: string | string[] | EntryContent[] | undefined) => {
    const next = { ...content } as Record<string, unknown>;
    if (v === undefined) delete next[k];
    else next[k] = v;
    onChange(next as SceneContent);
  };
  return (
    <>
      {used.map((k) => (
        <Kv key={k} k={t(`content.${k}`)} v={
          <span style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
            {k === 'image' ? (
              <ImagePick url={content.image} onPick={(url) => setKey('image', url)} />
            ) : k === 'clip' ? (
              <ClipPick url={content.clip} onPick={(url) => setKey('clip', url)} />
            ) : k === 'entries' ? (
              <EntriesEditor entries={content.entries ?? []} onChange={(entries) => setKey('entries', entries.length ? entries : undefined)} />
            ) : k === 'points' ? (
              <textarea className={`nc-textarea ${stopFlow}`} rows={3} placeholder={t('content.pointsHint')} value={(content.points ?? []).join('\n')} onChange={(e) => setKey('points', e.target.value.split('\n').map((x) => x.trimEnd()))} />
            ) : k === 'body' || k === 'quote' ? (
              <textarea className={`nc-textarea ${stopFlow}`} rows={2} value={content[k] ?? ''} onChange={(e) => setKey(k, e.target.value)} />
            ) : (
              <input className={`nc-input ${stopFlow}`} value={content[k] ?? ''} onChange={(e) => setKey(k, e.target.value)} />
            )}
            <button className={`nc-chip ${stopFlow}`} onClick={() => setKey(k, undefined)} title={t('common.remove')}><Icon.x size={9} /></button>
          </span>
        } />
      ))}
      {unused.length > 0 && (
        <select className={`nc-select ${stopFlow}`} value="" onChange={(e) => { const k = e.target.value as ContentKey; if (k) setKey(k, k === 'points' ? [] : k === 'entries' ? [{}, {}] : k === 'image' || k === 'clip' ? undefined : ''); }}>
          <option value="">{t('content.addKey')}</option>
          {unused.map((k) => <option key={k} value={k}>{t(`content.${k}`)}</option>)}
        </select>
      )}
    </>
  );
};
