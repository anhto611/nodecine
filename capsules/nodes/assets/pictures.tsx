'use client';
import React from 'react';
import { useHost, useParams } from '@/capsules/sdk/host';
import type { Asset } from '@/contracts/types/assets';
import { nameFor } from './node';

type AssetsParams = { items: Asset[]; removed: string[]; notes: Record<string, string>; pictures: number; wanted: string; attempt: number; found: Asset[] };

/** One picture as the card and the dialog show it: found for the video, or brought by a person. */
export interface Picture {
  key: string;
  asset: Asset;
  /** The note as it stands: a person's rewrite over the model's for a found picture. */
  note: string;
  found: boolean;
}

/** The pixel size of a picture file, read in the browser. */
const sizeOf = (file: File) => new Promise<{ width?: number; height?: number }>((resolve) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
  img.onerror = () => { resolve({}); URL.revokeObjectURL(url); };
  img.src = url;
});

export const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

/**
 * The node's pictures and what a person does to them, shared by the card and the dialog: add files,
 * rewrite a note, remove a picture. A picture found and a picture brought are handled alike.
 */
export function usePictures(nodeId: string) {
  const { uploadImage } = useHost();
  const [p, set] = useParams<AssetsParams>(nodeId);
  const items = React.useMemo(() => p.items ?? [], [p.items]);
  const removed = React.useMemo(() => new Set(p.removed ?? []), [p.removed]);
  const [busy, setBusy] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const pictures: Picture[] = [
    ...(p.found ?? []).filter((asset) => !removed.has(asset.url)).map((asset) => ({ key: `found:${asset.url}`, asset, note: p.notes?.[asset.url] ?? asset.note ?? '', found: true })),
    ...items.map((asset, i) => ({ key: `item:${i}:${asset.url}`, asset, note: asset.note ?? '', found: false })),
  ];

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
  const indexOf = (picture: Picture) => items.findIndex((a, i) => `item:${i}:${a.url}` === picture.key);
  const setNote = (picture: Picture, note: string) => {
    if (picture.found) set({ notes: { ...(p.notes ?? {}), [picture.asset.url]: note } });
    else set({ items: items.map((a, i) => (i === indexOf(picture) ? { ...a, note } : a)) });
  };
  const remove = (picture: Picture) => {
    if (!picture.found) { set({ items: items.filter((_, i) => i !== indexOf(picture)) }); return; }
    // A found picture is remembered as removed, so the next search does not bring it back.
    const { [picture.asset.url]: _note, ...notes } = p.notes ?? {};
    set({ removed: [...removed, picture.asset.url], notes });
  };

  return { pictures, add, setNote, remove, busy, error };
}

/** The file picker, as a chip. */
export const AddPictures: React.FC<{ busy: number; label: string; onFiles: (files: File[]) => void }> = ({ busy, label, onFiles }) => (
  <label className="nc-chip" style={{ cursor: 'pointer' }}>
    {busy ? `… ${busy}` : label}
    <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={(e) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = '';
      if (files.length) onFiles(files);
    }} />
  </label>
);

/** A picture as a tile: the whole picture on a dark ground, its name under it. */
export const PictureTile: React.FC<{ picture: Picture; selected?: boolean; onOpen: () => void; style?: React.CSSProperties }> = ({ picture, selected, onOpen, style }) => (
  <button className={`nc-chip ${selected ? 'on' : ''}`} onClick={onOpen} title={picture.note || picture.asset.name}
    style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4, padding: 4, minWidth: 0, textAlign: 'left', whiteSpace: 'normal', ...style }}>
    <div style={{ aspectRatio: '3 / 4', background: '#000', borderRadius: 3, overflow: 'hidden' }}>
      <img src={picture.asset.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
    </div>
    <div className="nc-hint one-line" style={{ marginTop: 0 }}>{picture.asset.name}</div>
  </button>
);
