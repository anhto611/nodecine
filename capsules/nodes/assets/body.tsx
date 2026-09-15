'use client';
import React from 'react';
import { Kv, useT, stopFlow } from '@/capsules/sdk/ui';
import { useHost, useParams, type BodyProps } from '@/capsules/sdk/host';
import type { Asset } from '@/contracts/types/assets';
import { nameFor } from './node';

/** The pixel size of a picture file, read in the browser. */
const sizeOf = (file: File) => new Promise<{ width?: number; height?: number }>((resolve) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
  img.onerror = () => { resolve({}); URL.revokeObjectURL(url); };
  img.src = url;
});

/**
 * The pictures as cards: each with an optional note for whoever writes the storyboard. A picture's name
 * is given from its file and kept; it is how a storyboard refers to it, not something a person types.
 */
export const AssetsBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const { uploadImage } = useHost();
  const [p, set] = useParams<{ items: Asset[] }>(nodeId);
  const items = p.items ?? [];
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
      </div>
      {error && <div style={{ fontSize: 'var(--fs-hint)', color: 'var(--err)', overflowWrap: 'anywhere' }}>{error}</div>}
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
      ) : <div className="nc-hint">{t('node.assetsNone')}</div>}
    </div>
  );
};
