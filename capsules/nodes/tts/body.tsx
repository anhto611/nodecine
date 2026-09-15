'use client';
import React from 'react';
import { ProviderPick } from '@/capsules/sdk/pickers';
import type { AudioScript, TTSRef, Voiceover } from '@/contracts/types/payloads';
import { Kv, useT, stopFlow } from '@/capsules/sdk/ui';
import { useGraph, useInputPayload, useLocale, useOutputPayload, useParams, useRuntime, type BodyProps } from '@/capsules/sdk/host';
import { FormBody } from '@/capsules/sdk/form-body';
import { pickVoice, voiceSpeaks } from './node';

/**
 * Which language the narration will be in. An explicit output language on the upstream node is
 * what the next run will produce, so it wins even over a script that already exists — the old
 * script may be from before the setting changed. Otherwise the script payload is the truth once
 * the upstream node has run and is not stale; until then the interface language is the guess.
 * Without this the list showed English voices to someone who had just switched to Vietnamese.
 */
function useScriptLanguage(nodeId: string, script: AudioScript | undefined): { lang: string; source: 'script' | 'guess' } {
  const graph = useGraph();
  const locale = useLocale();
  const edge = graph.edges.find((e) => e.target === nodeId && e.targetPort === 'script');
  const upstream = edge ? graph.nodes.find((n) => n.id === edge.source) : undefined;
  const upstreamState = useRuntime(upstream?.id ?? '')?.state;
  const set = upstream?.params.outputLanguage;
  if (typeof set === 'string' && set && set !== 'auto') return { lang: set, source: 'guess' };
  if (script?.language && upstreamState !== 'stale') return { lang: script.language, source: 'script' };
  return { lang: locale, source: 'guess' };
}

export const TtsBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ voice?: string }>(nodeId);
  const script = useInputPayload<AudioScript>(nodeId, 'script');
  const ref = useInputPayload<TTSRef>(nodeId, 'tts');
  const vo = useOutputPayload<Voiceover>(nodeId, 'voiceover');
  const { lang, source } = useScriptLanguage(nodeId, script);
  const all = ref?.voices ?? [];
  const matching = all.filter((v) => voiceSpeaks(v, lang));
  // Every other voice stays reachable, grouped by language, so a choice is never off the menu.
  const others = new Map<string, typeof all>();
  for (const v of all) if (!voiceSpeaks(v, lang)) others.set(v.language, [...(others.get(v.language) ?? []), v]);
  const auto = ref ? (() => { try { return pickVoice(ref, lang, p.voice); } catch { return null; } })() : null;
  return (
    <>
      <ProviderPick nodeId={nodeId} kind="tts" />
      <Kv k={t('node.voice')} v={<select className={`nc-select ${stopFlow}`} value={p.voice ?? ''} onChange={(e) => set({ voice: e.target.value || undefined })}>
        <option value="">{t('node.auto')}{auto && !p.voice ? ` · ${auto.voice.displayName}` : ''}</option>
        {matching.length > 0 && <optgroup label={lang}>{matching.map((v) => <option key={v.id} value={v.id}>{v.displayName}</option>)}</optgroup>}
        {[...others.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([language, voices]) => (
          <optgroup key={language} label={language}>{voices.map((v) => <option key={v.id} value={v.id}>{v.displayName}</option>)}</optgroup>
        ))}
      </select>} />
      <FormBody nodeId={nodeId} fields={['speed']} widgets={{ speed: { widget: 'range', step: 0.05, format: (v) => `${v.toFixed(2)}x` } }} />
      <div className="nc-hint">{t(source === 'script' ? 'node.matchesLanguage' : 'node.guessedLanguage', { lang })}{auto?.fallback ? ` · ${t('node.voiceMismatch')}` : ''}</div>
      {vo && (() => {
        const name = all.find((v) => v.id === vo.voiceName)?.displayName ?? vo.voiceName;
        return <div className="nc-hint one-line" style={{ color: 'var(--tx-2)' }} title={`${vo.durationSeconds.toFixed(2)}s · ${name}`}>{vo.durationSeconds.toFixed(2)}s · {name}</div>;
      })()}
    </>
  );
};
