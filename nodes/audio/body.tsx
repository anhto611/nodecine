'use client';
import React from 'react';
import { Kv, useT, stopFlow } from '@/components/ui';
import { FormBody } from '@/nodes/form-body';
import { useParams } from '@/nodes/kit';
import type { BodyProps } from '@/nodes/kit';

/** What this machine's music folder holds, asked for once and shared by every mix node on the canvas. */
function useTracks(): { tracks: string[]; folder: string; loading: boolean } {
  const [state, setState] = React.useState<{ tracks: string[]; folder: string; loading: boolean }>({ tracks: [], folder: '', loading: true });
  React.useEffect(() => {
    let alive = true;
    fetch('/api/music')
      .then((r) => r.json())
      .then((d: { tracks?: string[]; folder?: string }) => alive && setState({ tracks: d.tracks ?? [], folder: d.folder ?? '', loading: false }))
      .catch(() => alive && setState({ tracks: [], folder: '', loading: false }));
    return () => { alive = false; };
  }, []);
  return state;
}

export const AudioMixBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ track: string }>(nodeId);
  const { tracks, folder, loading } = useTracks();
  // A track chosen on another machine stays selectable, so opening the workflow never silently drops it.
  const options = p.track && !tracks.includes(p.track) ? [p.track, ...tracks] : tracks;
  return (
    <>
      <Kv
        k={t('node.track')}
        v={
          <select className={`nc-select ${stopFlow}`} value={p.track ?? ''} onChange={(e) => set({ track: e.target.value })}>
            <option value="">{t('node.noMusic')}</option>
            {options.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        }
      />
      {p.track ? (
        <FormBody
          nodeId={nodeId}
          fields={['volume', 'duck', 'fadeInSeconds', 'fadeOutSeconds']}
          widgets={{
            volume: { widget: 'range', step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
            duck: { widget: 'range', step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
            fadeInSeconds: { step: 0.5 },
            fadeOutSeconds: { step: 0.5 },
          }}
        />
      ) : (
        <div className="nc-hint">{loading ? t('node.musicLoading') : tracks.length ? t('node.musicHint') : t('node.musicEmpty')}</div>
      )}
      {!loading && !tracks.length && folder && <div className="nc-hint one-line" title={folder}>{folder}</div>}
    </>
  );
};
