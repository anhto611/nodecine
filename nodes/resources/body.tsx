'use client';
import React from 'react';
import type { EngineRef, LLMRef, TTSRef } from '@/core/types/payloads';
import { readCapability } from '@/core/nodes/definition';
import { Kv, Dot, useT, stopFlow } from '@/components/ui';
import { useNode, useRuntime, useStudio } from '@/store/useStudio';
import { findProvider, providersOfKind } from '@/providers/installed';
import { useParams, type BodyProps } from '@/nodes/kit';

/**
 * One capability, as a row: a label and a word. The reason a capability is unavailable is a
 * sentence, not a value, so it does not belong in a column half a node wide — it goes under the
 * rows with the remedy, where a sentence has the width to be read.
 */
const capRow = (payload: unknown, key: string, t: (k: string) => string) => {
  const c = readCapability(payload, key);
  if (!c) return null;
  const ok = c.status === 'ready';
  const color = ok ? 'var(--ok)' : 'var(--warn)';
  return <Kv key={key} k={t(`cap.${key}`)} v={<span title={ok ? undefined : c.reason} style={{ color }}><Dot color={color} />{t(ok ? 'state.ready' : 'state.notReady')}</span>} />;
};

/**
 * What went wrong, once per distinct problem. One provider failure usually takes several
 * capabilities down with it carrying the same reason and the same way out, and repeating that pair
 * per capability says nothing new.
 */
function capIssues(payload: unknown, keys: string[]): { reason?: string; fix?: string }[] {
  const seen = new Set<string>();
  const issues: { reason?: string; fix?: string }[] = [];
  for (const key of keys) {
    const c = readCapability(payload, key);
    if (!c || c.status === 'ready' || (!c.reason && !c.fix)) continue;
    const id = JSON.stringify([c.reason, c.fix]);
    if (seen.has(id)) continue;
    seen.add(id);
    issues.push({ reason: c.reason, fix: c.fix });
  }
  return issues;
}

/**
 * One body for both provider nodes: pick the provider, then whatever fields that provider declares.
 * The picker and the fields come from `providers/installed.ts`, so a new provider needs no UI work.
 */
const ProviderBody: React.FC<BodyProps & { kind: 'tts' | 'llm' }> = ({ nodeId, kind }) => {
  const t = useT();
  const rt = useRuntime(nodeId);
  const runNode = useStudio((s) => s.runNode);
  const [p, set] = useParams<{ providerId: string; settings: Record<string, unknown> }>(nodeId);
  const options = providersOfKind(kind);
  const chosen = findProvider(p.providerId);
  const ref = (kind === 'tts' ? rt?.outputs.tts?.payload : rt?.outputs.llm?.payload) as TTSRef | LLMRef | undefined;
  const caps = kind === 'tts' ? ['installed', 'encoder'] : ['installed', 'authenticated'];
  const settings = p.settings ?? {};
  const setSetting = (name: string, value: unknown) => set({ settings: { ...settings, [name]: value } });

  // A node dropped from the library starts empty; offer the first provider rather than an error.
  React.useEffect(() => {
    if (!p.providerId && options[0]) set({ providerId: options[0].id, settings: { ...options[0].defaultSettings } });
  }, [p.providerId, options, set]);

  return (
    <>
      <Kv k={t('node.provider')} v={
        <select className={`nc-select ${stopFlow}`} value={p.providerId} onChange={(e) => {
          const next = findProvider(e.target.value);
          set({ providerId: e.target.value, settings: { ...(next?.defaultSettings ?? {}) } });
          // Capabilities and the voice list belong to whichever provider was probed, so leaving the
          // previous one's results under the new name reads as fact. Probe now, not at the next run.
          void runNode(nodeId);
        }}>
          {!p.providerId && <option value="">—</option>}
          {options.map((o) => <option key={o.id} value={o.id}>{t(o.nameKey)}</option>)}
        </select>
      } />
      {chosen?.noteKey && <div className="nc-hint">{t(chosen.noteKey)}</div>}
      {ref ? caps.map((k) => capRow(ref, k, t)) : <Kv k={t('node.status')} v="—" dim />}
      {capIssues(ref, caps).map((issue, i) => (
        <div key={i} className="nc-hint">
          {issue.reason && <div style={{ color: 'var(--warn)' }}>{issue.reason}</div>}
          {issue.fix && <div style={{ color: 'var(--tx-2)' }}>$ {issue.fix}</div>}
        </div>
      ))}
      {kind === 'llm' && (ref as LLMRef | undefined)?.capabilities.version && (
        <Kv k={t('node.tool')} v={`${p.providerId} ${(ref as LLMRef).capabilities.version}`} />
      )}
      {kind === 'tts' && <Kv k={t('node.voices')} v={ref ? String((ref as TTSRef).voices.length) : '—'} />}
      {chosen?.fields.map((f) => (
        <Kv key={f.name} k={t(f.label)} v={
          f.type === 'number' ? (
            <input className={`nc-input ${stopFlow}`} type="number" style={{ width: 70 }} min={f.min} max={f.max} step={f.step}
              value={String(settings[f.name] ?? '')} onChange={(e) => setSetting(f.name, e.target.value === '' ? undefined : Number(e.target.value))} />
          ) : f.type === 'select' ? (
            <select className={`nc-select ${stopFlow}`} value={String(settings[f.name] ?? '')} onChange={(e) => setSetting(f.name, e.target.value)}>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input className={`nc-input ${stopFlow}`} placeholder={f.placeholder}
              value={String(settings[f.name] ?? '')} onChange={(e) => setSetting(f.name, e.target.value || undefined)} />
          )
        } />
      ))}
      <div className="nc-hint">{t('node.probeEveryRun')}</div>
    </>
  );
};

export const LlmProviderBody: React.FC<BodyProps> = ({ nodeId }) => <ProviderBody nodeId={nodeId} kind="llm" />;
export const TtsProviderBody: React.FC<BodyProps> = ({ nodeId }) => <ProviderBody nodeId={nodeId} kind="tts" />;

export const EngineBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const rt = useRuntime(nodeId);
  const node = useNode(nodeId);
  const [p, set] = useParams<{ concurrency?: number; glBackend?: string }>(nodeId);
  const ref = rt?.outputs.engine?.payload as EngineRef | undefined;
  return (
    <>
      <Kv k={t('node.adapter')} v={ref ? `${ref.engineId} ${ref.adapterVersion}` : '—'} />
      {ref ? ['preview', 'render'].map((k) => capRow(ref, k, t)) : null}
      {node?.type === 'core/remotion-engine' && (
        <>
          <Kv k={t('node.concurrency')} v={<input className={`nc-input ${stopFlow}`} style={{ width: 50 }} type="number" min={1} placeholder="auto" value={p.concurrency ?? ''} onChange={(e) => set({ concurrency: e.target.value ? Number(e.target.value) : undefined })} />} />
          <Kv k={t('node.backend')} v={<select className={`nc-select ${stopFlow}`} value={p.glBackend ?? 'angle'} onChange={(e) => set({ glBackend: e.target.value })}><option value="angle">angle</option><option value="swiftshader">swiftshader</option></select>} />
        </>
      )}
    </>
  );
};
