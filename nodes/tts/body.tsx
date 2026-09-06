'use client';
import React from 'react';
import type { AudioScript, TTSRef, Voiceover } from '@/core/types/payloads';
import { Kv, useT, stopFlow } from '@/components/ui';
import { useInputPayload, useRuntime, useStudio } from '@/store/useStudio';
import { useParams, type BodyProps } from '@/nodes/kit';
import { pickVoice, voiceSpeaks } from './node';

/**
 * Which language the narration will be in, before there is a narration. The script payload is the
 * truth once the upstream node has run; until then the director's own setting is the best guess,
 * and the interface language after that. Without this the list showed English voices to someone
 * who had set everything to Vietnamese and simply had not pressed Run yet.
 */
function useScriptLanguage(nodeId: string, script: AudioScript | undefined): { lang: string; source: 'script' | 'guess' } {
  const graph = useStudio((s) => s.graph);
  const locale = useStudio((s) => s.locale);
  if (script?.language) return { lang: script.language, source: 'script' };
  const edge = graph.edges.find((e) => e.target === nodeId && e.targetPort === 'script');
  const upstream = edge ? graph.nodes.find((n) => n.id === edge.source) : undefined;
  const set = upstream?.params.outputLanguage;
  if (typeof set === 'string' && set && set !== 'auto') return { lang: set, source: 'guess' };
  return { lang: locale, source: 'guess' };
}

export const TtsBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ voice?: string; speed: number }>(nodeId);
  const script = useInputPayload<AudioScript>(nodeId, 'script');
  const ref = useInputPayload<TTSRef>(nodeId, 'tts');
  const rt = useRuntime(nodeId);
  const vo = rt?.outputs.voiceover?.payload as Voiceover | undefined;
  const { lang, source } = useScriptLanguage(nodeId, script);
  const all = ref?.voices ?? [];
  const matching = all.filter((v) => voiceSpeaks(v, lang));
  // Every other voice stays reachable, grouped by language, so a choice is never off the menu.
  const others = new Map<string, typeof all>();
  for (const v of all) if (!voiceSpeaks(v, lang)) others.set(v.language, [...(others.get(v.language) ?? []), v]);
  const auto = ref ? (() => { try { return pickVoice(ref, lang, p.voice); } catch { return null; } })() : null;
  return (
    <>
      <Kv k={t('node.voice')} v={<select className={`nc-select ${stopFlow}`} value={p.voice ?? ''} onChange={(e) => set({ voice: e.target.value || undefined })}>
        <option value="">{t('node.auto')}{auto && !p.voice ? ` · ${auto.voice.displayName}` : ''}</option>
        {matching.length > 0 && <optgroup label={lang}>{matching.map((v) => <option key={v.id} value={v.id}>{v.displayName}</option>)}</optgroup>}
        {[...others.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([language, voices]) => (
          <optgroup key={language} label={language}>{voices.map((v) => <option key={v.id} value={v.id}>{v.displayName}</option>)}</optgroup>
        ))}
      </select>} />
      <Kv k={t('node.speed')} v={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input className={stopFlow} type="range" min={0.5} max={2} step={0.05} value={p.speed} onChange={(e) => set({ speed: Number(e.target.value) })} style={{ width: 70 }} />{p.speed.toFixed(2)}x</span>} />
      <div className="nc-hint">{t(source === 'script' ? 'node.matchesLanguage' : 'node.guessedLanguage', { lang })}{auto?.fallback ? ` · ${t('node.voiceMismatch')}` : ''}</div>
      {vo && <div className="nc-hint" style={{ color: 'var(--tx-2)' }}>{vo.durationSeconds.toFixed(2)}s · {vo.voiceName}</div>}
    </>
  );
};
