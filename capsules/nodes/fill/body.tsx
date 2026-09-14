'use client';
import React from 'react';
import { Kv, useT, stopFlow } from '@/capsules/sdk/ui';
import { useHost, useInputPayload, useParams, type BodyProps } from '@/capsules/sdk/host';
import type { Composition, CompositionVariable } from '@/contracts/types/composition';
import { FILLED } from './node';

/** Variables the run fills from the voice-over; a person never types these. */
const FROM_THE_RUN = new Set<string>([FILLED.voiceover, FILLED.voiceoverSeconds]);

/** A picture: choose a file, see its name, clear it. */
const ImageControl: React.FC<{ value: unknown; onChange: (v: unknown) => void }> = ({ value, onChange }) => {
  const t = useT();
  const { uploadImage } = useHost();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const url = typeof value === 'string' ? value : (value as { url?: string } | undefined)?.url;
  return (
    <span className={stopFlow} style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
      {url && <img src={url} alt="" style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 3, flex: 'none' }} />}
      <label className="nc-chip" style={{ cursor: 'pointer' }} title={error ?? undefined}>
        {busy ? '…' : url ? t('node.fillReplace') : t('node.fillChoose')}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true); setError(null);
          try { onChange(await uploadImage(file)); } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
        }} />
      </label>
      {url && <button className="nc-chip" onClick={() => onChange(undefined)}>×</button>}
      {error && <span style={{ color: 'var(--err)', fontSize: 'var(--fs-hint)' }}>{error}</span>}
    </span>
  );
};

/** One control per declared variable, of the kind its type calls for; blank keeps the default. */
const Control: React.FC<{ variable: CompositionVariable; value: unknown; onChange: (v: unknown) => void }> = ({ variable, value, onChange }) => {
  const options = (variable as { options?: { value: string; label?: string }[] }).options;
  switch (variable.type) {
    case 'number':
      return <input className={`nc-input ${stopFlow}`} type="number" value={typeof value === 'number' ? value : ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />;
    case 'boolean':
      return <input className={stopFlow} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />;
    case 'color':
      return <input className={stopFlow} type="color" value={typeof value === 'string' ? value : String(variable.default ?? '#000000')} onChange={(e) => onChange(e.target.value)} />;
    case 'image':
      return <ImageControl value={value} onChange={onChange} />;
    case 'enum':
      return (
        <select className={`nc-select ${stopFlow}`} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">—</option>
          {(options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label ?? o.value}</option>)}
        </select>
      );
    default:
      return <input className={`nc-input ${stopFlow}`} value={typeof value === 'string' ? value : ''} placeholder={variable.default === undefined ? '' : String(variable.default)} onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)} />;
  }
};

export const FillBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ values: Record<string, unknown> }>(nodeId);
  const composition = useInputPayload<Composition>(nodeId, 'composition');
  const values = p.values ?? {};
  if (!composition) return <div className="nc-hint">{t('node.fillNoComposition')}</div>;
  return (
    <>
      {composition.variables.filter((v) => !FROM_THE_RUN.has(v.id)).map((v) => (
        <Kv key={v.id} k={v.label ?? v.id} v={<Control variable={v} value={values[v.id]} onChange={(next) => {
          const { [v.id]: _old, ...rest } = values;
          set({ values: next === undefined ? rest : { ...rest, [v.id]: next } });
        }} />} />
      ))}
    </>
  );
};
