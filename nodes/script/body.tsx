'use client';
import React from 'react';
import { CONTENT_KEYS, type ContentKey, type SceneContent } from '@/core/types/payloads';
import { Kv, Btn, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useParams, type BodyProps } from '@/nodes/kit';

type SceneRow = { role: string; weight: number; content: SceneContent };

/** Body of the Static Script: the narration, then the scenes, each a role, a weight and its content in the vocabulary. */
export const StaticScriptBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ script: string; scenes: SceneRow[] }>(nodeId);
  const scenes = p.scenes ?? [];
  const update = (i: number, patch: Partial<SceneRow>) => set({ scenes: scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const remove = (i: number) => set({ scenes: scenes.filter((_, j) => j !== i) });
  const add = () => set({ scenes: [...scenes, { role: `scene ${scenes.length + 1}`, weight: 1, content: { title: '' } }] });
  return (
    <>
      <div className="nc-k">{t('node.script')}</div>
      <textarea className={`nc-textarea ${stopFlow}`} value={p.script ?? ''} onChange={(e) => set({ script: e.target.value })} />
      <div className="nc-k" style={{ marginTop: 4 }}>{t('node.scenes')}</div>
      {scenes.map((s, i) => (
        <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 3, padding: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div className="nc-scene-row">
            <span className="nc-k" style={{ color: 'var(--accent-2)' }}>{i + 1}</span>
            <input className={`nc-input ${stopFlow}`} style={{ flex: 1, minWidth: 0 }} value={s.role} title={t('director.role')} onChange={(e) => update(i, { role: e.target.value })} />
            <input className={`nc-input ${stopFlow}`} style={{ width: 38 }} type="number" min={0.1} step={0.5} value={s.weight} title={t('node.weight')} onChange={(e) => update(i, { weight: Number(e.target.value) || 1 })} />
            <button className={`nc-chip ${stopFlow}`} onClick={() => remove(i)} disabled={scenes.length <= 1} title="remove"><Icon.x size={9} /></button>
          </div>
          <ContentEditor content={s.content ?? {}} onChange={(content) => update(i, { content })} />
        </div>
      ))}
      <Btn small className={stopFlow} onClick={add} style={{ alignSelf: 'flex-start' }}><Icon.plus size={10} /> {t('node.addScene')}</Btn>
    </>
  );
};

/** One input per content key the scene uses, and a picker to add another; points are one per line. */
const ContentEditor: React.FC<{ content: SceneContent; onChange: (c: SceneContent) => void }> = ({ content, onChange }) => {
  const t = useT();
  const used = CONTENT_KEYS.filter((k) => k in content);
  const unused = CONTENT_KEYS.filter((k) => !(k in content));
  const setKey = (k: ContentKey, v: string | string[] | undefined) => {
    const next = { ...content } as Record<string, unknown>;
    if (v === undefined) delete next[k];
    else next[k] = v;
    onChange(next as SceneContent);
  };
  return (
    <>
      {used.map((k) => (
        <Kv key={k} k={t(`content.${k}`)} v={
          <span style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
            {k === 'points' ? (
              <textarea className={`nc-textarea ${stopFlow}`} rows={3} placeholder={t('script.pointsHint')} value={(content.points ?? []).join('\n')} onChange={(e) => setKey('points', e.target.value.split('\n').map((x) => x.trimEnd()))} />
            ) : k === 'body' || k === 'quote' ? (
              <textarea className={`nc-textarea ${stopFlow}`} rows={2} value={content[k] ?? ''} onChange={(e) => setKey(k, e.target.value)} />
            ) : (
              <input className={`nc-input ${stopFlow}`} value={content[k] ?? ''} onChange={(e) => setKey(k, e.target.value)} />
            )}
            <button className={`nc-chip ${stopFlow}`} onClick={() => setKey(k, undefined)} title={t('look.remove')}><Icon.x size={9} /></button>
          </span>
        } />
      ))}
      {unused.length > 0 && (
        <select className={`nc-select ${stopFlow}`} value="" onChange={(e) => { const k = e.target.value as ContentKey; if (k) setKey(k, k === 'points' ? [] : ''); }}>
          <option value="">{t('script.addKey')}</option>
          {unused.map((k) => <option key={k} value={k}>{t(`content.${k}`)}</option>)}
        </select>
      )}
    </>
  );
};
