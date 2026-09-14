'use client';
import React from 'react';
import { Kv, useT, stopFlow } from '@/components/ui';
import { useParams } from '@/nodes/kit';
import { findProvider, providersOfKind } from '@/providers/installed';
import { listEngineIds } from '@/contracts/adapters/registry';

/**
 * The part a node needs, chosen on the node itself (CORE_CONTRACTS §1.3): a model, a voice, an engine.
 *
 * These were nodes of their own until 2026-09-12, wired in on a second kind of port, and the reason a
 * node could not run was reported on a different node from the one that failed. What is left of that
 * idea is this row: the node names what it needs, and probes it when it runs.
 */
export const ProviderPick: React.FC<{ nodeId: string; kind: 'llm' | 'tts'; optional?: boolean }> = ({ nodeId, kind, optional }) => {
  const t = useT();
  const field = kind === 'llm' ? 'llmProvider' : 'ttsProvider';
  const [p, set] = useParams<Record<string, unknown>>(nodeId);
  const options = providersOfKind(kind);
  const current = String(p[field] ?? '');
  const settingsField = kind === 'llm' ? 'llmSettings' : 'ttsSettings';

  // A node dropped from the library starts empty; offer the first one rather than an error.
  React.useEffect(() => {
    if (!optional && !current && options[0]) set({ [field]: options[0].id, [settingsField]: { ...options[0].defaultSettings } });
  }, [current, options, set, field, settingsField, optional]);

  return (
    <Kv k={t(kind === 'llm' ? 'node.llmProvider' : 'node.ttsProvider')} v={
      <select className={`nc-select ${stopFlow}`} value={current} onChange={(e) => {
        const next = findProvider(e.target.value);
        set({ [field]: e.target.value, [settingsField]: { ...(next?.defaultSettings ?? {}) } });
      }}>
        {(optional || !current) && <option value="">—</option>}
        {options.map((o) => <option key={o.id} value={o.id}>{t(o.nameKey)}</option>)}
      </select>
    } />
  );
};

/** The engine an output node draws with. */
export const EnginePick: React.FC<{ nodeId: string }> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<Record<string, unknown>>(nodeId);
  const options = listEngineIds();
  const current = String(p.engineId ?? '');
  React.useEffect(() => {
    if (!current && options[0]) set({ engineId: options[0] });
  }, [current, options, set]);
  return (
    <Kv k={t('node.engineId')} v={
      <select className={`nc-select ${stopFlow}`} value={current} onChange={(e) => set({ engineId: e.target.value, engineSettings: {} })}>
        {!current && <option value="">—</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    } />
  );
};
