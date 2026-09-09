'use client';
import React from 'react';
import type { CoverDef } from '@/core/types/payloads';
import { Kv, useT, stopFlow } from '@/components/ui';
import { uploadImage } from '@/nodes/art-director/editor/assets.client';

/**
 * The form a cover's props make — used twice, on purpose (CORE_CONTRACTS §2.13, §5.18).
 *
 * The Art Director fills it to say what the cover *is*: the ground, the words it ships with. The
 * Cover Image node fills the same form to change one of them for one export. Two forms would drift,
 * and the person would be looking at a different cover in each place.
 */
export const CoverFields: React.FC<{
  cover: CoverDef;
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  /** What an empty box means here: the cover's own value underneath (the export), or nothing (the design). */
  placeholderHint?: string;
}> = ({ cover, values, onChange, placeholderHint }) => {
  const t = useT();
  return (
    <>
      {placeholderHint ? <div className="nc-hint">{placeholderHint}</div> : null}
      {Object.entries(cover.props).map(([name, field]) => (
        <Kv key={name} k={name} v={<CoverField field={field} value={values[name]} onChange={(v) => onChange(name, v)} />} />
      ))}
      {Object.keys(cover.props).length === 0 ? <div className="nc-hint">{t('look.coverNoProps')}</div> : null}
    </>
  );
};

const CoverField: React.FC<{ field: CoverDef['props'][string]; value: unknown; onChange: (v: unknown) => void }> = ({ field, value, onChange }) => {
  const t = useT();
  const ref = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  if (field.type === 'image') {
    const url = typeof value === 'string' ? value : undefined;
    return (
      <span style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setBusy(true); void uploadImage(f).then(onChange).finally(() => setBusy(false)); } }} />
        {url ? <img src={url} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 3, border: '1px solid var(--line-2)', flex: 'none' }} /> : null}
        <button className={`nc-chip ${stopFlow}`} onClick={() => ref.current?.click()} disabled={busy}>{busy ? '…' : t(url ? 'script.imageSwap' : 'script.imagePick')}</button>
        {url ? <button className={`nc-chip ${stopFlow}`} onClick={() => onChange(undefined)} title={t('look.remove')}>×</button> : null}
      </span>
    );
  }
  // A `<video>` in a cover comes out black: the still is taken by a capture session, which does not
  // run the producer's extract-videos stage. The clip still reaches the cover — as a frame, taken
  // with ffmpeg and put behind an image prop — so point at that instead of offering a picker that
  // quietly produces a black picture.
  if (field.type === 'video') return <span className="nc-hint" style={{ color: 'var(--warn)' }}>{t('look.coverNoClip')}</span>;
  if (field.type === 'text') return <textarea className={`nc-textarea ${stopFlow}`} rows={2} value={String(value ?? '')} maxLength={field.max} placeholder={field.hint} onChange={(e) => onChange(e.target.value)} />;
  return <input className={`nc-input ${stopFlow}`} value={String(value ?? '')} maxLength={field.max} placeholder={field.hint} onChange={(e) => onChange(e.target.value)} />;
};
