'use client';
import React from 'react';
import { CONTENT_KEYS, type ContentKey, type SceneContent } from '@/core/types/payloads';
import { Kv, Btn, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useParams, type BodyProps } from '@/nodes/kit';
import { uploadImage, useLibraryFile } from '@/nodes/art-director/editor/assets.client';
import { LibraryPicker, useLibrary } from '@/nodes/library-picker';

type SceneRow = { role: string; weight: number; narration: string; content: SceneContent };

/** Body of the Static Script: the scenes, each a role, a weight, what the voice says over it, and its content in the vocabulary. */
export const StaticScriptBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ scenes: SceneRow[] }>(nodeId);
  const scenes = p.scenes ?? [];
  const update = (i: number, patch: Partial<SceneRow>) => set({ scenes: scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const remove = (i: number) => set({ scenes: scenes.filter((_, j) => j !== i) });
  const add = () => set({ scenes: [...scenes, { role: `scene ${scenes.length + 1}`, weight: 1, narration: '', content: { title: '' } }] });
  return (
    <>
      <div className="nc-k">{t('node.scenes')}</div>
      {scenes.map((s, i) => (
        <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 3, padding: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div className="nc-scene-row">
            <span className="nc-k" style={{ color: 'var(--accent-2)' }}>{i + 1}</span>
            <input className={`nc-input ${stopFlow}`} style={{ flex: 1, minWidth: 0 }} value={s.role} title={t('screenwriter.role')} onChange={(e) => update(i, { role: e.target.value })} />
            <input className={`nc-input ${stopFlow}`} style={{ width: 38 }} type="number" min={0.1} step={0.5} value={s.weight} title={t('node.weight')} onChange={(e) => update(i, { weight: Number(e.target.value) || 1 })} />
            <button className={`nc-chip ${stopFlow}`} onClick={() => remove(i)} disabled={scenes.length <= 1} title="remove"><Icon.x size={9} /></button>
          </div>
          <textarea className={`nc-textarea ${stopFlow}`} rows={2} placeholder={t('node.script')} title={t('node.script')} value={s.narration ?? ''} onChange={(e) => update(i, { narration: e.target.value })} />
          <ContentEditor content={s.content ?? {}} onChange={(content) => update(i, { content })} />
        </div>
      ))}
      <Btn small className={stopFlow} onClick={add} style={{ alignSelf: 'flex-start' }}><Icon.plus size={10} /> {t('node.addScene')}</Btn>
    </>
  );
};

/** The scene's picture: upload one and the scene carries the asset it becomes. */
const ImagePick: React.FC<{ url?: string; onPick: (url: string | undefined) => void }> = ({ url, onPick }) => {
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
      <button className={`nc-chip ${stopFlow}`} onClick={() => ref.current?.click()} disabled={busy}>{busy ? '…' : t(url ? 'script.imageSwap' : 'script.imagePick')}</button>
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
      <LibraryPicker files={files} value={name} empty={busy ? '…' : t('script.clipPick')} onChange={(f) => void take(f)} />
      {!loading && !files.length && folder ? <span className="nc-hint one-line" title={folder}>{t('script.clipsEmpty')}</span> : null}
      {err ? <span className="nc-hint" style={{ color: 'var(--err)' }} title={err}>!</span> : null}
    </span>
  );
};

/** One input per content key the scene uses, and a picker to add another; points are one per line. */
const ContentEditor: React.FC<{ content: SceneContent; onChange: (c: SceneContent) => void }> = ({ content, onChange }) => {
  const t = useT();
  const used = CONTENT_KEYS.filter((k) => k in content);
  const unused = CONTENT_KEYS.filter((k) => !(k in content));
  const setKey = (k: ContentKey, v: string | string[] | undefined) => {
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
            ) : k === 'points' ? (
              <textarea className={`nc-textarea ${stopFlow}`} rows={3} placeholder={t('script.pointsHint')} value={(content.points ?? []).join('\n')} onChange={(e) => setKey('points', e.target.value.split('\n').map((x) => x.trimEnd()))} />
            ) : k === 'body' || k === 'quote' ? (
              <textarea className={`nc-textarea ${stopFlow}`} rows={2} value={content[k] ?? ''} onChange={(e) => setKey(k, e.target.value)} />
            ) : (
              <input className={`nc-input ${stopFlow}`} value={content[k] ?? ''} onChange={(e) => setKey(k, e.target.value)} />
            )}
            <button className={`nc-chip ${stopFlow}`} onClick={() => setKey(k, undefined)} title={t('look.remove')}><Icon.x size={9} /></button>
          </span>
        } />
      ))}
      {unused.length > 0 && (
        <select className={`nc-select ${stopFlow}`} value="" onChange={(e) => { const k = e.target.value as ContentKey; if (k) setKey(k, k === 'points' ? [] : k === 'image' || k === 'clip' ? undefined : ''); }}>
          <option value="">{t('script.addKey')}</option>
          {unused.map((k) => <option key={k} value={k}>{t(`content.${k}`)}</option>)}
        </select>
      )}
    </>
  );
};
