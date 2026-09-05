'use client';
import React from 'react';
import { z } from 'zod';
import { getScene, listScenes } from '@/core/scenes/registry';
import { OUTPUT_LANGUAGES, languageName } from '@/core/text/languages';
import type { Slot } from '@/core/director/slots';
import type { AudioScript, DirectorPlan } from '@/core/types/payloads';
import { Btn, Kv, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useNode, useRuntime, useStudio } from '@/store/useStudio';
import type { BodyProps } from './bodies';

type Params = { prompt: string; outputLanguage: string; theme: string; scenes: Slot[] };

/** The prop keys of a scene type, so the slot editor can offer a fact binding for each. */
function propKeys(sceneType: string): string[] {
  const schema = getScene(sceneType)?.propsSchema;
  return schema instanceof z.ZodObject ? Object.keys(schema.shape) : [];
}

/**
 * Body of the one director: the brief, the language, the theme, then the scene slots — each a scene
 * type from the registry, a weight, a count, and for every prop the choice between letting the model
 * write it or binding it to a fact. Everything a user can decide about a video is on this card.
 */
export const AiDirectorBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const node = useNode(nodeId);
  const setParams = useStudio((s) => s.setParams);
  const rt = useRuntime(nodeId);
  const p = (node?.params ?? {}) as Partial<Params>;
  const slots = p.scenes ?? [];
  const scenes = listScenes();
  const plan = rt?.outputs.plan?.payload as DirectorPlan | undefined;
  const script = rt?.outputs.script?.payload as AudioScript | undefined;
  const raw = (rt?.error?.details as { raw?: unknown } | undefined)?.raw;

  const set = (patch: Partial<Params>) => setParams(nodeId, patch);
  const updateSlot = (i: number, patch: Partial<Slot>) => set({ scenes: slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const removeSlot = (i: number) => set({ scenes: slots.filter((_, j) => j !== i) });
  const addSlot = () => set({ scenes: [...slots, { sceneType: scenes[0]?.sceneType ?? 'core/title-card', weight: 1, count: 1, factBindings: {} }] });
  const bind = (i: number, prop: string, factKey: string) => {
    const next = { ...slots[i]!.factBindings };
    if (factKey.trim()) next[prop] = factKey.trim();
    else delete next[prop];
    updateSlot(i, { factBindings: next });
  };

  return (
    <>
      <div className="nc-k">{t('director.brief')}</div>
      <textarea className={`nc-textarea ${stopFlow}`} value={p.prompt ?? ''} onChange={(e) => set({ prompt: e.target.value })} />
      <Kv k={t('director.outputLanguage')} v={
        <select className={`nc-select ${stopFlow}`} value={p.outputLanguage ?? 'auto'} onChange={(e) => set({ outputLanguage: e.target.value })}>
          {OUTPUT_LANGUAGES.map((l) => <option key={l} value={l}>{l === 'auto' ? t('node.auto') : `${l} · ${languageName(l)}`}</option>)}
        </select>
      } />
      <Kv k={t('node.theme')} v={<input className={`nc-input ${stopFlow}`} value={p.theme ?? ''} onChange={(e) => set({ theme: e.target.value })} />} />

      <div className="nc-k" style={{ marginTop: 4 }}>{t('director.scenes')}</div>
      {slots.map((s, i) => {
        const keys = propKeys(s.sceneType);
        return (
          <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 3, padding: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div className="nc-scene-row">
              <span className="nc-k" style={{ color: 'var(--accent-2)' }}>{i + 1}</span>
              <select className={`nc-select ${stopFlow}`} value={s.sceneType} onChange={(e) => updateSlot(i, { sceneType: e.target.value, factBindings: {} })}>
                {scenes.map((sc) => <option key={sc.sceneType} value={sc.sceneType}>{sc.sceneType}</option>)}
              </select>
              <input className={`nc-input ${stopFlow}`} style={{ width: 38 }} type="number" min={0.1} step={0.5} value={s.weight} title={t('node.weight')} onChange={(e) => updateSlot(i, { weight: Number(e.target.value) || 1 })} />
              <span className="nc-k">{t('director.count')}</span>
              <input className={`nc-input ${stopFlow}`} style={{ width: 34 }} type="number" min={1} max={12} step={1} value={s.count} onChange={(e) => updateSlot(i, { count: Math.max(1, Math.min(12, Math.round(Number(e.target.value) || 1))) })} />
              <button className={`nc-chip ${stopFlow}`} onClick={() => removeSlot(i)} disabled={slots.length <= 1} title="remove"><Icon.x size={9} /></button>
            </div>
            {keys.map((k) => (
              <Kv key={k} k={k} v={
                <input className={`nc-input ${stopFlow}`} placeholder={t('director.bindNone')} title={t('director.bind')} value={s.factBindings[k] ?? ''} onChange={(e) => bind(i, k, e.target.value)} />
              } />
            ))}
          </div>
        );
      })}
      <Btn small className={stopFlow} onClick={addSlot} style={{ alignSelf: 'flex-start' }}><Icon.plus size={10} /> {t('node.addScene')}</Btn>

      {script && plan && (
        <>
          <div className="nc-k" style={{ marginTop: 4 }}>{t('director.narration', { n: script.text.split(/\s+/).length })}</div>
          <div style={{ fontSize: 9, color: 'var(--tx-2)', lineHeight: 1.5, maxHeight: 54, overflow: 'hidden' }}>{script.text}</div>
          <div className="nc-k" style={{ marginTop: 4 }}>{t('director.written')}</div>
          {plan.scenes.map((s, i) => (
            <div key={i} className="nc-kv"><span className="nc-k">{i + 1} · {s.sceneType.split('/')[1]}</span><span className="nc-v">{String(s.props.headline ?? s.props.text ?? '')}</span></div>
          ))}
        </>
      )}
      {raw != null && (
        <>
          <div className="nc-k" style={{ marginTop: 4, color: 'var(--err)' }}>{t('director.rawOutput')}</div>
          <pre className={`nc-textarea ${stopFlow}`} style={{ margin: 0, maxHeight: 70, overflow: 'auto', fontSize: 8.5, whiteSpace: 'pre-wrap' }}>{typeof raw === 'string' ? raw : JSON.stringify(raw, null, 1)}</pre>
        </>
      )}
    </>
  );
};
