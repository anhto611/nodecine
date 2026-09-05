'use client';
import React from 'react';
import type { BlockDef, StageDef } from '@/core/types/payloads';
import { Kv, Btn, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useParams, type BodyProps } from '@/nodes/kit';
import { useWiredLook } from '@/nodes/look/body';

type SceneRow = { blockId: string; weight: number; props: Record<string, unknown>; tone?: string; fields?: Record<string, string> };
export const StaticScriptBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ script: string; scenes: SceneRow[] }>(nodeId);
  const { stage, blocks } = useWiredLook(nodeId);
  const update = (i: number, patch: Partial<SceneRow>) => set({ scenes: p.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const remove = (i: number) => set({ scenes: p.scenes.filter((_, j) => j !== i) });
  const add = () => set({ scenes: [...p.scenes, { blockId: blocks[0]?.id ?? 'text-card', weight: 1, props: {} }] });
  return (
    <>
      <div className="nc-k">{t('node.script')}</div>
      <textarea className={`nc-textarea ${stopFlow}`} value={p.script} onChange={(e) => set({ script: e.target.value })} />
      <div className="nc-k" style={{ marginTop: 4 }}>{t('node.scenes')}</div>
      {!stage || blocks.length === 0 ? <div className="nc-hint" style={{ color: 'var(--warn)' }}>{t('director.noLook')}</div> : null}
      {p.scenes.map((s, i) => {
        const block = blocks.find((b) => b.id === s.blockId);
        return (
          <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 3, padding: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div className="nc-scene-row">
              <span className="nc-k" style={{ color: 'var(--accent-2)' }}>{i + 1}</span>
              <select className={`nc-select ${stopFlow}`} value={s.blockId} onChange={(e) => update(i, { blockId: e.target.value, props: {} })}>
                {!block ? <option value={s.blockId}>{s.blockId}</option> : null}
                {blocks.map((b) => <option key={b.id} value={b.id}>{b.id}</option>)}
              </select>
              <input className={`nc-input ${stopFlow}`} style={{ width: 38 }} type="number" min={0.1} step={0.5} value={s.weight} title={t('node.weight')} onChange={(e) => update(i, { weight: Number(e.target.value) || 1 })} />
              <button className={`nc-chip ${stopFlow}`} onClick={() => remove(i)} disabled={p.scenes.length <= 1} title="remove"><Icon.x size={9} /></button>
            </div>
            <ToneAndFields stage={stage} tone={s.tone} fields={s.fields} onChange={(patch) => update(i, patch)} />
            {block ? <BlockPropsInputs block={block} props={s.props} onChange={(props) => update(i, { props })} /> : null}
          </div>
        );
      })}
      <Btn small className={stopFlow} onClick={add} style={{ alignSelf: 'flex-start' }}><Icon.plus size={10} /> {t('node.addScene')}</Btn>
    </>
  );
};

/** Tone picker and the stage's per-scene fields, shown only when the stage has them. */
const ToneAndFields: React.FC<{ stage?: StageDef; tone?: string; fields?: Record<string, string>; onChange: (patch: { tone?: string; fields?: Record<string, string> }) => void }> = ({ stage, tone, fields, onChange }) => {
  const t = useT();
  if (!stage) return null;
  const tones = Object.keys(stage.tones);
  return (
    <>
      {tones.length ? (
        <Kv k={t('node.tone')} v={
          <select className={`nc-select ${stopFlow}`} value={tone ?? ''} onChange={(e) => onChange({ tone: e.target.value || undefined })}>
            <option value="">{t('node.toneBase')}</option>
            {tones.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        } />
      ) : null}
      {stage.sceneFields.map((f) => (
        <Kv key={f.name} k={f.name} v={
          f.options?.length ? (
            <select className={`nc-select ${stopFlow}`} value={fields?.[f.name] ?? ''} onChange={(e) => onChange({ fields: { ...(fields ?? {}), [f.name]: e.target.value } })}>
              <option value="">—</option>
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input className={`nc-input ${stopFlow}`} title={f.rule} placeholder={f.rule} value={fields?.[f.name] ?? ''} onChange={(e) => onChange({ fields: { ...(fields ?? {}), [f.name]: e.target.value } })} />
          )
        } />
      ))}
    </>
  );
};

/** One input per block prop, typed by the field: numbers as numbers, lists as one item per line. */
const BlockPropsInputs: React.FC<{ block: BlockDef; props: Record<string, unknown>; onChange: (props: Record<string, unknown>) => void }> = ({ block, props, onChange }) => {
  const setProp = (k: string, v: unknown) => onChange({ ...props, [k]: v });
  return (
    <>
      {Object.entries(block.props).map(([k, f]) => {
        const v = props[k];
        const title = `${k}${f.hint ? ` — ${f.hint}` : ''}`;
        if (f.type === 'boolean') {
          return <Kv key={k} k={k} v={<input className={stopFlow} type="checkbox" checked={Boolean(v)} onChange={(e) => setProp(k, e.target.checked)} />} />;
        }
        if (f.type === 'number') {
          return <Kv key={k} k={k} v={<input className={`nc-input ${stopFlow}`} type="number" min={f.min} max={f.max} title={title} value={typeof v === 'number' ? v : ''} onChange={(e) => setProp(k, e.target.value === '' ? undefined : Number(e.target.value))} />} />;
        }
        if (f.type === 'string[]') {
          return <textarea key={k} className={`nc-textarea ${stopFlow}`} rows={3} placeholder={title} title={title} value={Array.isArray(v) ? (v as string[]).join('\n') : ''} onChange={(e) => setProp(k, e.target.value ? e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) : undefined)} />;
        }
        if (f.type === 'text') {
          return <textarea key={k} className={`nc-textarea ${stopFlow}`} rows={2} placeholder={title} title={title} value={(v as string) ?? ''} onChange={(e) => setProp(k, e.target.value || undefined)} />;
        }
        return <input key={k} className={`nc-input ${stopFlow}`} placeholder={title} title={title} value={(v as string) ?? ''} onChange={(e) => setProp(k, e.target.value || undefined)} />;
      })}
    </>
  );
};
