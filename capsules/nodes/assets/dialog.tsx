'use client';
import React from 'react';
import { Btn, Dialog, Kv, useT } from '@/capsules/sdk/ui';
import { useNode, useOverlay } from '@/capsules/sdk/host';
import { AddPictures, hostOf, PictureTile, usePictures } from './pictures';

/** What the dialog opens on: the picture chosen on the card, if one was. */
export type AssetsDialogData = { key?: string };

/** Every picture of the node as a wall: open one to see it large, write its note, or remove it. */
export const AssetsDialog: React.FC = () => {
  const t = useT();
  const overlay = useOverlay();
  const nodeId = overlay.current?.nodeId ?? '';
  const node = useNode(nodeId);
  const { pictures, add, setNote, remove, busy, error } = usePictures(nodeId);
  const [openKey, setOpenKey] = React.useState<string | null>((overlay.current?.data as AssetsDialogData | undefined)?.key ?? null);
  if (!overlay.current || node?.type !== 'assets') return null;
  const open = pictures.find((x) => x.key === openKey) ?? null;

  return (
    <Dialog
      width="min(1240px, 95vw)"
      height="90vh"
      title={t('node.assets')}
      onClose={overlay.close}
      titleExtra={
        <span style={{ display: 'flex', gap: 8, marginLeft: 12, alignItems: 'center' }}>
          <AddPictures busy={busy} label={t('node.assetsAdd')} onFiles={(files) => void add(files)} />
          <span className="nc-hint" style={{ marginTop: 0 }}>{t('node.assetsCount', { count: pictures.length })}</span>
        </span>
      }
    >
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {error && <div className="nc-hint" style={{ marginTop: 0, color: 'var(--err)' }}>{error}</div>}
          {pictures.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {pictures.map((picture) => <PictureTile key={picture.key} picture={picture} selected={picture.key === openKey} onOpen={() => setOpenKey(picture.key)} />)}
            </div>
          ) : <div className="nc-hint">{t('node.assetsNone')}</div>}
          {pictures.some((x) => x.found) && <div className="nc-hint">{t('node.assetsFoundRights')}</div>}
        </div>

        {open && (
          <div style={{ width: 440, flex: 'none', borderLeft: '1px solid var(--line)', padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <b style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{open.asset.name}</b>
              <button className="nc-chip" onClick={() => setOpenKey(null)}>×</button>
            </div>
            <div style={{ background: '#000', borderRadius: 4, display: 'flex', justifyContent: 'center' }}>
              <img src={open.asset.url} alt="" style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain', display: 'block' }} />
            </div>
            <Kv wide k={<label htmlFor={`${nodeId}-note`}>{t('node.assetsNoteLabel')}</label>} v={
              <textarea id={`${nodeId}-note`} className="nc-textarea" rows={3} maxLength={500} placeholder={t('node.assetsNote')} value={open.note} onChange={(e) => setNote(open, e.target.value)} />
            } />
            <div className="nc-hint" style={{ marginTop: 0 }}>
              {open.asset.width ? `${open.asset.width}×${open.asset.height}` : ''}
              {open.asset.source ? <> · <a href={open.asset.source} target="_blank" rel="noreferrer" style={{ color: 'var(--tx-3)' }}>{hostOf(open.asset.source)}</a></> : open.found ? '' : ` · ${t('node.assetsBrought')}`}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn small danger onClick={() => { remove(open); setOpenKey(null); }}>{t('node.assetsRemove')}</Btn>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
