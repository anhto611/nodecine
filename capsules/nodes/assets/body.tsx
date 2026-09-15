'use client';
import React from 'react';
import { Btn, Kv, useT, stopFlow } from '@/capsules/sdk/ui';
import { useHost, useInputPayload, useParams, useRun, type BodyProps } from '@/capsules/sdk/host';
import { ProviderPick } from '@/capsules/sdk/pickers';
import type { Asset } from '@/contracts/types/assets';
import type { Brief } from '@/contracts/types/brief';
import type { Research } from '@/contracts/types/research';
import { nameFor } from './node';

/** The pixel size of a picture file, read in the browser. */
const sizeOf = (file: File) => new Promise<{ width?: number; height?: number }>((resolve) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
  img.onerror = () => { resolve({}); URL.revokeObjectURL(url); };
  img.src = url;
});

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

/**
 * The pictures as cards: the ones found for this video, each kept or left out, then the ones a person
 * brought. Each has a note for whoever writes the storyboard. A picture's name is given from its file or
 * its note and kept; it is how a storyboard refers to it, not something a person types.
 */
export const AssetsBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const { uploadImage } = useHost();
  const [p, set] = useParams<{ items: Asset[]; dropped: string[]; notes: Record<string, string>; pictures: number; wanted: string; attempt: number; found: Asset[] }>(nodeId);
  const { running, runNode } = useRun();
  const items = p.items ?? [];
  const found = p.found ?? [];
  // Finding pictures needs something to find them for: a brief or research wired in.
  const briefIn = useInputPayload<Brief>(nodeId, 'brief');
  const researchIn = useInputPayload<Research>(nodeId, 'research');
  const searchable = !!briefIn || !!researchIn;
  const [settings, setSettings] = React.useState(false);
  const findAgain = () => {
    set({ attempt: (p.attempt ?? 0) + 1 });
    setTimeout(() => runNode(nodeId), 0);
  };
  const label = { fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' };
  const dropped = new Set(p.dropped ?? []);
  const toggle = (url: string) => set({ dropped: dropped.has(url) ? [...dropped].filter((u) => u !== url) : [...dropped, url] });
  const [busy, setBusy] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const add = async (files: File[]) => {
    setError(null);
    setBusy(files.length);
    let next = items;
    for (const file of files) {
      try {
        const [url, size] = await Promise.all([uploadImage(file), sizeOf(file)]);
        next = [...next, { name: nameFor(file.name, next.map((a) => a.name)), url, note: '', ...size }];
        set({ items: next });
      } catch (e) {
        setError(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy((n) => n - 1);
      }
    }
  };
  const update = (i: number, patch: Partial<Asset>) => set({ items: items.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  const remove = (i: number) => set({ items: items.filter((_, j) => j !== i) });

  return (
    <div className={stopFlow} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <label className="nc-chip" style={{ cursor: 'pointer' }}>
          {busy ? `… ${busy}` : t('node.assetsAdd')}
          <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length) void add(files);
          }} />
        </label>
        <Kv k="" v={t('node.assetsCount', { count: items.length })} dim />
        <button className="nc-chip" style={{ marginLeft: 'auto' }} aria-expanded={settings} onClick={() => setSettings(!settings)}>{settings ? t('node.assetsSearchHide') : t('node.assetsSearch')}</button>
      </div>
      {settings && (
        <div style={{ display: 'grid', gap: 6, padding: 6, border: '1px solid var(--line)', borderRadius: 6 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <label htmlFor={`${nodeId}-assets-pictures`} style={label}>{t('node.assetsPictureCount')}</label>
            <select id={`${nodeId}-assets-pictures`} className="nc-select" value={p.pictures ?? 8} onChange={(e) => set({ pictures: Number(e.target.value) })}>
              {[0, 4, 6, 8, 10, 12, 16, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <ProviderPick nodeId={nodeId} kind="llm" />
          <label htmlFor={`${nodeId}-assets-wanted`} style={{ display: 'grid', gap: 3 }}>
            <span style={label}>{t('node.assetsWanted')}</span>
            <textarea id={`${nodeId}-assets-wanted`} className="nc-textarea" style={{ minHeight: 80 }} maxLength={4000} placeholder={t('node.assetsWantedHint')} value={p.wanted ?? ''} onChange={(e) => set({ wanted: e.target.value })} />
          </label>
          {!searchable && <div className="nc-hint" style={{ marginTop: 0 }}>{t('node.assetsSearchUnwired')}</div>}
        </div>
      )}
      {error && <div style={{ fontSize: 'var(--fs-hint)', color: 'var(--err)', overflowWrap: 'anywhere' }}>{error}</div>}
      {found.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' }}>{t('node.assetsFound', { kept: found.filter((a) => !dropped.has(a.url)).length, count: found.length })}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflowY: 'auto' }}>
            {found.map((asset) => {
              const off = dropped.has(asset.url);
              return (
                <div key={asset.url} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 6, border: '1px solid var(--line)', borderRadius: 6, minWidth: 0, opacity: off ? 0.45 : 1 }}>
                  <div style={{ position: 'relative', background: 'var(--bg-2, #0002)', borderRadius: 4, overflow: 'hidden' }}>
                    <img src={asset.url} alt="" style={{ display: 'block', width: '100%', height: 'auto' }} />
                    <button className={`nc-chip ${off ? '' : 'on'}`} aria-pressed={!off} style={{ position: 'absolute', top: 4, right: 4 }} onClick={() => toggle(asset.url)}>{off ? t('node.assetsUse') : t('node.assetsUsed')}</button>
                  </div>
                  {!off && <textarea className="nc-textarea" style={{ minHeight: 44 }} placeholder={t('node.assetsNote')} value={p.notes?.[asset.url] ?? asset.note ?? ''} onChange={(e) => set({ notes: { ...(p.notes ?? {}), [asset.url]: e.target.value } })} />}
                  <div className="nc-hint one-line" style={{ marginTop: 0 }} title={asset.source}>
                    {asset.width && `${asset.width}×${asset.height}`}{asset.source ? <> · <a href={asset.source} target="_blank" rel="noreferrer" style={{ color: 'var(--tx-3)' }}>{hostOf(asset.source)}</a></> : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="nc-hint" style={{ marginTop: 0 }}>{t('node.assetsFoundRights')}</div>
          {searchable && <Btn small style={{ alignSelf: 'flex-start' }} disabled={running} onClick={findAgain}>{t('node.assetsFindAgain')}</Btn>}
        </div>
      )}
      {items.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflowY: 'auto' }}>
          {items.map((asset, i) => {
            return (
              <div key={`${asset.url}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 6, border: '1px solid var(--line)', borderRadius: 6, minWidth: 0 }}>
                {/* The picture across the card's full width, as tall as its own shape makes it. */}
                <div style={{ position: 'relative', background: 'var(--bg-2, #0002)', borderRadius: 4, overflow: 'hidden' }}>
                  <img src={asset.url} alt="" style={{ display: 'block', width: '100%', height: 'auto' }} />
                  <button className="nc-chip" style={{ position: 'absolute', top: 4, right: 4 }} onClick={() => remove(i)}>×</button>
                </div>
                <textarea className="nc-textarea" style={{ minHeight: 44 }} placeholder={t('node.assetsNote')} value={asset.note ?? ''} onChange={(e) => update(i, { note: e.target.value })} />
                {asset.width && <div style={{ fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' }}>{asset.width}×{asset.height}</div>}
              </div>
            );
          })}
        </div>
      ) : !found.length && <div className="nc-hint">{t('node.assetsNone')}</div>}
    </div>
  );
};
