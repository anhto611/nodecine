'use client';
import React from 'react';
import { Kv, useT, stopFlow } from '@/capsules/sdk/ui';
import { useHost, useInputPayload, useLocale, useParams, type BodyProps } from '@/capsules/sdk/host';
import { labelOf, type BlockVariable } from '@/contracts/storyboard/blocks';
import { FILM_SECONDS, type Composition, type CompositionVariable } from '@/contracts/types/composition';
import { FILLED } from './node';

/** Variables the run fills itself — from the voice-over, or from the scenes laid on the clock; a person never types these. */
const FROM_THE_RUN = new Set<string>([FILLED.voiceover, FILLED.voiceoverSeconds, FILM_SECONDS]);

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

/**
 * A colour. A picker always shows some colour, so it cannot say by itself whether this film has chosen
 * one: unset, it shows the kit's own colour and says so, and once chosen it can be given back to the kit.
 */
const ColourControl: React.FC<{ variable: CompositionVariable; value: unknown; onChange: (v: unknown) => void }> = ({ variable, value, onChange }) => {
  const t = useT();
  const set = typeof value === 'string';
  return (
    <span className={stopFlow} style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
      <input type="color" value={set ? value : String(variable.default ?? '#000000')} onChange={(e) => onChange(e.target.value)} />
      {set
        ? <button className="nc-chip" title={t('node.fillFollowKit')} onClick={() => onChange(undefined)}>×</button>
        : <span style={{ color: 'var(--tx-3)', fontSize: 'var(--fs-hint)' }}>{t('node.fillFromKit')}</span>}
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
      return <ColourControl variable={variable} value={value} onChange={onChange} />;
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
  const locale = useLocale();
  const [p, set] = useParams<{ values: Record<string, unknown> }>(nodeId);
  const composition = useInputPayload<Composition>(nodeId, 'composition');
  const values = p.values ?? {};
  if (!composition) return <div className="nc-hint">{t('node.fillNoComposition')}</div>;
  const asked = composition.variables.filter((v) => !FROM_THE_RUN.has(v.id));
  // A kit whose look is all its own asks a person for nothing: say so rather than showing an empty card.
  if (!asked.length) return <div className="nc-hint">{t('node.fillNothingToSet')}</div>;
  return (
    <>
      {asked.map((v) => (
        <Kv key={v.id} k={v.label ? labelOf(v as unknown as BlockVariable, locale) : v.id} v={<Control variable={v} value={values[v.id]} onChange={(next) => {
          const { [v.id]: _old, ...rest } = values;
          set({ values: next === undefined ? rest : { ...rest, [v.id]: next } });
        }} />} />
      ))}
    </>
  );
};
