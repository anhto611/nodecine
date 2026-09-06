'use client';
import React from 'react';
import { Kv, useT, stopFlow } from '@/components/ui';
import { getNodeType } from '@/core/nodes/definition';
import { hasTranslation } from '@/lib/i18n';
import { useNode } from '@/store/useStudio';
import { schemaFields, settleNumber, type FormField } from './form';
import { useParams } from './kit';

/**
 * How one field departs from what the schema alone would draw. Everything is optional: a body that
 * passes nothing gets a plain input per field, labelled `node.<name>` from the dictionary.
 */
export type FieldWidget = {
  /** A string field as a multi-line box; a bounded number as a slider. */
  widget?: 'textarea' | 'range';
  /** No label row: the control takes the whole width (an Input Trigger's text, for instance). */
  label?: false;
  placeholder?: string;
  step?: number;
  /** How a slider shows its value. */
  format?: (v: number) => string;
  /** Draw this field yourself, in its schema position; the form only supplies the label row. */
  render?: React.ReactNode;
};

/**
 * The parameter form of a node, generated from its `paramsSchema` (ARCHITECTURE §2). Enums become
 * selects, strings inputs, numbers bounded inputs, booleans checkboxes; labels come from the
 * dictionary by field name, and an enum value gets its own label when `node.<field>.<value>` exists.
 * `fields` picks a subset, in the order given; `widgets` adjusts or replaces single fields.
 */
export const FormBody: React.FC<{ nodeId: string; fields?: string[]; widgets?: Record<string, FieldWidget> }> = ({ nodeId, fields, widgets = {} }) => {
  const t = useT();
  const node = useNode(nodeId);
  const [p, set] = useParams<Record<string, unknown>>(nodeId);
  const all = React.useMemo(() => (node ? schemaFields(getNodeType(node.type)?.paramsSchema ?? ({} as never)) : []), [node?.type]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = fields ? fields.map((n) => all.find((f) => f.name === n)).filter((f): f is FormField => !!f) : all;
  return (
    <>
      {shown.map((f) => {
        const w = widgets[f.name] ?? {};
        const control = w.render ?? <Control field={f} widget={w} value={p[f.name]} onChange={(v) => set({ [f.name]: v })} />;
        if (w.label === false) return <React.Fragment key={f.name}>{control}</React.Fragment>;
        return <Kv key={f.name} k={t(`node.${f.name}`)} v={control} />;
      })}
    </>
  );
};

const Control: React.FC<{ field: FormField; widget: FieldWidget; value: unknown; onChange: (v: unknown) => void }> = ({ field, widget, value, onChange }) => {
  const t = useT();
  switch (field.kind) {
    case 'select':
      return (
        <select className={`nc-select ${stopFlow}`} value={String(value ?? field.defaultValue ?? '')} onChange={(e) => onChange(e.target.value)}>
          {field.options.map((o) => <option key={o} value={o}>{hasTranslation(`node.${field.name}.${o}`) ? t(`node.${field.name}.${o}`) : o}</option>)}
        </select>
      );
    case 'boolean':
      return <input className={stopFlow} type="checkbox" checked={!!(value ?? field.defaultValue)} onChange={(e) => onChange(e.target.checked)} />;
    case 'text':
      if (widget.widget === 'textarea') return <textarea className={`nc-textarea ${stopFlow}`} value={String(value ?? '')} placeholder={widget.placeholder} maxLength={field.max} onChange={(e) => onChange(e.target.value)} />;
      return <input className={`nc-input ${stopFlow}`} value={String(value ?? '')} placeholder={widget.placeholder} maxLength={field.max} onChange={(e) => onChange(field.optional && e.target.value === '' ? undefined : e.target.value)} />;
    case 'number':
      return <NumberControl field={field} widget={widget} value={value as number | undefined} onChange={onChange} />;
  }
};

/** Free typing while focused; the schema's bounds apply when the field is left. */
const NumberControl: React.FC<{ field: Extract<FormField, { kind: 'number' }>; widget: FieldWidget; value: number | undefined; onChange: (v: number | undefined) => void }> = ({ field, widget, value, onChange }) => {
  const [draft, setDraft] = React.useState<string | null>(null);
  const step = widget.step ?? (field.integer ? 1 : 0.01);
  if (widget.widget === 'range' && field.min !== undefined && field.max !== undefined) {
    const v = value ?? field.defaultValue ?? field.min;
    return (
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input className={stopFlow} type="range" min={field.min} max={field.max} step={step} value={v} onChange={(e) => onChange(Number(e.target.value))} style={{ width: 70 }} />
        {widget.format ? widget.format(v) : String(v)}
      </span>
    );
  }
  return (
    <input
      className={`nc-input ${stopFlow}`}
      type="number"
      min={field.min}
      max={field.max}
      step={step}
      placeholder={widget.placeholder}
      value={draft ?? (value === undefined ? '' : String(value))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft !== null) { onChange(settleNumber(field, draft)); setDraft(null); } }}
    />
  );
};
