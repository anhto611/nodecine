'use client';
import React from 'react';
import { Btn, useT, stopFlow } from '@/capsules/sdk/ui';
import { useInputPayload, useOverlay, useParams, useRun, type BodyProps } from '@/capsules/sdk/host';
import { FormBody } from '@/capsules/sdk/form-body';
import { ProviderPick } from '@/capsules/sdk/pickers';
import type { Brief } from '@/contracts/types/brief';
import type { AssetsDialogData } from './dialog';
import { AddPictures, PictureTile, usePictures } from './pictures';

export { AssetsDialog } from './dialog';

const PICTURE_COUNTS = [0, 4, 6, 8, 10, 12, 16, 20] as const;
/** Pictures across the card, a half one at the edge saying the row scrolls. */
const ACROSS = 3.5;
const GAP = 4;
const TILE = `calc((100% - ${Math.floor(ACROSS) * GAP}px) / ${ACROSS})`;

/**
 * The pictures as a strip, the way the Composition node shows its parts: the wall opens on "see all" or on
 * a picture, where each is seen large, given its note, or removed. Above the strip, how the
 * pictures are found: the model, how many, and what the workflow's videos need.
 */
export const AssetsBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const overlay = useOverlay();
  const [p, set] = useParams<{ pictures: number; attempt: number; removed: string[] }>(nodeId);
  const { running, runNode } = useRun();
  const { pictures, add, busy, error } = usePictures(nodeId);
  // Finding pictures needs something to find them for: a brief wired in.
  const searchable = !!useInputPayload<Brief>(nodeId, 'brief');
  const [settings, setSettings] = React.useState(false);
  const openWall = (key?: string) => overlay.open(nodeId, (key ? { key } : {}) satisfies AssetsDialogData);
  const findAgain = () => {
    // A new search from scratch: a picture removed from the last one may be found again.
    set({ attempt: (p.attempt ?? 0) + 1, removed: [] });
    setTimeout(() => runNode(nodeId), 0);
  };

  return (
    <div className={stopFlow} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <ProviderPick nodeId={nodeId} kind="llm" />
      <FormBody nodeId={nodeId} fields={['pictures']} widgets={{ pictures: { labelKey: 'node.assetsPictureCount', options: PICTURE_COUNTS.map((n) => ({ value: n, label: String(n) })) } }} />
      {!searchable && (p.pictures ?? 8) > 0 && (
        <div className="nc-hint" style={{ marginTop: 0 }}>
          {t('node.assetsSearchUnwired')}
        </div>
      )}
      <button className="nc-chip" style={{ alignSelf: 'flex-start' }} aria-expanded={settings} onClick={() => setSettings(!settings)}>
        {settings ? t('node.assetsSearchHide') : t('node.assetsSearch')}
      </button>
      {settings && <FormBody nodeId={nodeId} fields={['wanted']} widgets={{ wanted: { widget: 'textarea', rows: 4, labelKey: 'node.assetsWanted', placeholder: t('node.assetsWantedHint') } }} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="nc-k">{t('node.assetsCount', { count: pictures.length })}</span>
        <AddPictures busy={busy} label={t('node.assetsAdd')} onFiles={(files) => void add(files)} />
        {pictures.length > 0 && (
          <button className="nc-chip" style={{ marginLeft: 'auto', border: 0 }} onClick={() => openWall()}>
            {t('node.assetsSeeAll')}
          </button>
        )}
      </div>
      {error && (
        <div className="nc-hint" style={{ marginTop: 0, color: 'var(--err)' }}>
          {error}
        </div>
      )}
      {pictures.length ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: GAP, overflowX: 'auto', paddingBottom: 2 }}>
          {pictures.map((picture) => (
            <PictureTile key={picture.key} picture={picture} onOpen={() => openWall(picture.key)} style={{ flex: `0 0 ${TILE}` }} />
          ))}
        </div>
      ) : (
        <div className="nc-hint" style={{ marginTop: 0 }}>
          {t('node.assetsNone')}
        </div>
      )}
      {searchable && (p.pictures ?? 8) > 0 && (
        <Btn small style={{ alignSelf: 'flex-start' }} disabled={running} onClick={findAgain}>
          {t('node.assetsFindAgain')}
        </Btn>
      )}
    </div>
  );
};
