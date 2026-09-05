'use client';
import React from 'react';
import type { AudioScript, TTSRef, Voiceover } from '@/core/types/payloads';
import { Kv, useT, stopFlow } from '@/components/ui';
import { useInputPayload, useRuntime } from '@/store/useStudio';
import { useParams, type BodyProps } from '@/nodes/kit';
import { pickVoice } from './node';

export const TtsBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ voice?: string; speed: number }>(nodeId);
  const script = useInputPayload<AudioScript>(nodeId, 'script');
  const ref = useInputPayload<TTSRef>(nodeId, 'tts');
  const rt = useRuntime(nodeId);
  const vo = rt?.outputs.voiceover?.payload as Voiceover | undefined;
  const lang = script?.language ?? 'en';
  const voices = ref?.voices.filter((v) => v.language.toLowerCase().startsWith(lang.toLowerCase())) ?? [];
  const auto = ref && script ? (() => { try { return pickVoice(ref, lang, p.voice); } catch { return null; } })() : null;
  return (
    <>
      <Kv k={t('node.voice')} v={<select className={`nc-select ${stopFlow}`} value={p.voice ?? ''} onChange={(e) => set({ voice: e.target.value || undefined })}>
        <option value="">{t('node.auto')}{auto ? ` · ${auto.voice.displayName}` : ''}</option>
        {voices.map((v) => <option key={v.id} value={v.id}>{v.displayName}</option>)}
      </select>} />
      <Kv k={t('node.speed')} v={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input className={stopFlow} type="range" min={0.5} max={2} step={0.05} value={p.speed} onChange={(e) => set({ speed: Number(e.target.value) })} style={{ width: 70 }} />{p.speed.toFixed(2)}x</span>} />
      <div className="nc-hint">{t('node.matchesLanguage', { lang })}{auto?.fallback ? ` · ${t('state.notReady')}` : ''}</div>
      {vo && <div className="nc-hint" style={{ color: 'var(--tx-2)' }}>{vo.durationSeconds.toFixed(2)}s · {vo.voiceName}</div>}
    </>
  );
};
