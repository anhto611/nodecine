'use client';
import React from 'react';
import { ProviderPick } from '@/capsules/sdk/pickers';
import type { AudioScript, TTSRef, Voiceover } from '@/contracts/types/payloads';
import { Kv, useT, stopFlow } from '@/capsules/sdk/ui';
import { useGraph, useHost, useInputPayload, useOutputPayload, useParams, useRuntime, type BodyProps } from '@/capsules/sdk/host';
import { FormBody } from '@/capsules/sdk/form-body';
import { resolveOutputLanguage } from '@/contracts/text/languages';
import { pickVoice, voiceSpeaks } from './node';

/**
 * Which language the narration will be in. Once the node that writes it has run and is not stale, its
 * script says. Before that it is that node's own language setting, or, left on auto, the language of the
 * brief it writes from. The Studio's own language plays no part: it only shows the app.
 */
function useScriptLanguage(nodeId: string, script: AudioScript | undefined): { lang: string; source: 'script' | 'guess' } {
  const graph = useGraph();
  const edge = graph.edges.find((e) => e.target === nodeId && e.targetPort === 'script');
  const upstream = edge ? graph.nodes.find((n) => n.id === edge.source) : undefined;
  const upstreamState = useRuntime(upstream?.id ?? '')?.state;
  if (script?.language && upstreamState !== 'stale') return { lang: script.language, source: 'script' };
  const chosen = (upstream?.params as { language?: unknown } | undefined)?.language;
  const briefWire = upstream ? graph.edges.find((e) => e.target === upstream.id && e.targetPort === 'brief') : undefined;
  const about = (briefWire ? (graph.nodes.find((n) => n.id === briefWire.source)?.params as { about?: unknown } | undefined) : undefined)?.about;
  return { lang: resolveOutputLanguage(typeof chosen === 'string' ? chosen : 'auto', typeof about === 'string' ? about : ''), source: 'guess' };
}

export const TtsBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const { action } = useHost();
  const [p, set] = useParams<{ voice?: string; ttsProvider?: string; ttsSettings?: Record<string, unknown> }>(nodeId);
  const script = useInputPayload<AudioScript>(nodeId, 'script');
  // The chosen service's voices, asked of the server whenever the service or its settings change.
  const [ref, setRef] = React.useState<TTSRef | null>(null);
  const [voicesError, setVoicesError] = React.useState<string | null>(null);
  const settingsKey = JSON.stringify(p.ttsSettings ?? {});
  React.useEffect(() => {
    if (!p.ttsProvider) return;
    let gone = false;
    setVoicesError(null);
    action<TTSRef>('tts/voices', [p.ttsProvider, p.ttsSettings ?? {}]).then(
      (r) => {
        if (!gone) setRef(r);
      },
      (e: unknown) => {
        if (!gone) {
          setRef(null);
          setVoicesError(e instanceof Error ? e.message : String(e));
        }
      },
    );
    return () => {
      gone = true;
    };
    // The settings are compared by content, not by the object that carries them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.ttsProvider, settingsKey]);
  const vo = useOutputPayload<Voiceover>(nodeId, 'voiceover');
  const { lang, source } = useScriptLanguage(nodeId, script);
  const all = ref?.voices ?? [];
  const matching = all.filter((v) => voiceSpeaks(v, lang));
  // Every other voice stays reachable, grouped by language, so a choice is never off the menu.
  const others = new Map<string, typeof all>();
  for (const v of all) if (!voiceSpeaks(v, lang)) others.set(v.language, [...(others.get(v.language) ?? []), v]);
  const auto = ref
    ? (() => {
        try {
          return pickVoice(ref, lang, p.voice);
        } catch {
          return null;
        }
      })()
    : null;
  return (
    <>
      <ProviderPick nodeId={nodeId} kind="tts" />
      <Kv
        k={t('node.voice')}
        v={
          <select className={`nc-select ${stopFlow}`} value={p.voice ?? ''} onChange={(e) => set({ voice: e.target.value || undefined })}>
            <option value="">
              {t('node.auto')}
              {auto && !p.voice ? ` · ${auto.voice.displayName}` : ''}
            </option>
            {matching.length > 0 && (
              <optgroup label={lang}>
                {matching.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.displayName}
                  </option>
                ))}
              </optgroup>
            )}
            {[...others.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([language, voices]) => (
                <optgroup key={language} label={language}>
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.displayName}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
        }
      />
      {voicesError && (
        <div className="nc-hint clamp" style={{ color: 'var(--warn)' }} title={voicesError}>
          {t('node.voicesUnavailable')}: {voicesError}
        </div>
      )}
      {!ref && !voicesError && p.ttsProvider && <div className="nc-hint">{t('node.voicesLoading')}</div>}
      <FormBody nodeId={nodeId} fields={['speed']} widgets={{ speed: { widget: 'range', step: 0.05, format: (v) => `${v.toFixed(2)}x` } }} />
      <div className="nc-hint">
        {t(source === 'script' ? 'node.matchesLanguage' : 'node.guessedLanguage', { lang })}
        {auto?.fallback ? ` · ${t('node.voiceMismatch')}` : ''}
      </div>
      {vo &&
        (() => {
          const name = all.find((v) => v.id === vo.voiceName)?.displayName ?? vo.voiceName;
          return (
            <div className="nc-hint one-line" style={{ color: 'var(--tx-2)' }} title={`${vo.durationSeconds.toFixed(2)}s · ${name}`}>
              {vo.durationSeconds.toFixed(2)}s · {name}
            </div>
          );
        })()}
    </>
  );
};
