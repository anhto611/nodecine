'use client';
import React from 'react';
import { Kv, useT, stopFlow } from '@/capsules/sdk/ui';
import { useHost, useOutputPayload, useParams, type BodyProps } from '@/capsules/sdk/host';
import type { Footage } from '@/contracts/types/footage';

/**
 * The clip on the card: choose one and watch it. What it turned out to be — how long, how big — is
 * shown once the node has run, because that is measured from the file, never guessed here; and what
 * language is spoken on it is nobody's to say, so nobody is asked.
 */
export const FootageBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const { uploadFile } = useHost();
  const [p, set] = useParams<{ clip?: string; name?: string }>(nodeId);
  const out = useOutputPayload<Footage>(nodeId, 'footage');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const choose = async (file: File) => {
    setBusy(true); setError(null);
    try { set({ clip: await uploadFile(file), name: file.name }); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Kv k={t('node.footageClip')} v={
        <span className={stopFlow} style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
          <label className="nc-chip" style={{ cursor: 'pointer' }}>
            {busy ? '…' : t(p.clip ? 'node.footageReplace' : 'node.footageChoose')}
            <input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v" hidden onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void choose(file);
            }} />
          </label>
          {p.name && <span style={{ color: 'var(--tx-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.name}>{p.name}</span>}
        </span>
      } />
      {p.clip && (
        // Muted on purpose: a card that starts talking when the canvas is opened is nobody's friend.
        <video className={stopFlow} src={p.clip} controls muted playsInline preload="metadata"
          style={{ width: '100%', maxHeight: 260, borderRadius: 6, background: '#000' }} />
      )}
      {error && <div className="nc-hint" style={{ color: 'var(--err)', overflowWrap: 'anywhere' }}>{error}</div>}
      {out
        ? <div className="nc-hint">{out.width}×{out.height} · {out.fps}fps · {out.durationSeconds.toFixed(2)}s{out.hasAudio ? '' : ` · ${t('node.footageSilent')}`}</div>
        : <div className="nc-hint">{t('node.footageHint')}</div>}
    </>
  );
};
