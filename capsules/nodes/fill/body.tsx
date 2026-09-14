'use client';
import React from 'react';
import { Kv, useT, stopFlow } from '@/capsules/sdk/ui';
import { useInputPayload, useParams, type BodyProps } from '@/capsules/sdk/host';
import type { Composition, CompositionVariable } from '@/contracts/types/composition';

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
      {composition.variables.map((v) => (
        <Kv key={v.id} k={v.label ?? v.id} v={<Control variable={v} value={values[v.id]} onChange={(next) => {
          const { [v.id]: _old, ...rest } = values;
          set({ values: next === undefined ? rest : { ...rest, [v.id]: next } });
        }} />} />
      ))}
    </>
  );
};
