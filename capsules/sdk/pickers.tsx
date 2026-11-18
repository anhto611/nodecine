'use client';
import React from 'react';
import { Kv, useT, stopFlow } from './ui';
import { useHost, useParams } from './host';

/**
 * The voice service a node speaks with, chosen on the node itself, or left automatic: empty means the
 * service is chosen for the script's language when the node runs (`resolveAutoTTS`). `autoName` is
 * what automatic comes to now, when the node knows. A model is not chosen here: the workflow has one
 * for all its nodes (`contracts/workflow-model.ts`), picked in the agent panel.
 *
 * These were nodes of their own until 2026-09-12, wired in on a second kind of port, and the reason a
 * node could not run was reported on a different node from the one that failed. What is left of that
 * idea is this row: the node names what it needs, and probes it when it runs.
 */
export const ProviderPick: React.FC<{ nodeId: string; kind: 'tts'; autoName?: string }> = ({ nodeId, kind, autoName }) => {
  const t = useT();
  const field = 'ttsProvider';
  const [p, set] = useParams<Record<string, unknown>>(nodeId);
  const options = useHost().providers(kind);
  const current = String(p[field] ?? '');
  const settingsField = 'ttsSettings';

  return (
    <Kv
      k={t('node.ttsProvider')}
      v={
        <select
          className={`nc-select ${stopFlow}`}
          value={current}
          onChange={(e) => {
            const next = options.find((o) => o.id === e.target.value);
            set({ [field]: e.target.value, [settingsField]: next ? { ...next.defaultSettings } : {} });
          }}
        >
          <option value="">{autoName ? `${t('node.auto')} · ${autoName}` : t('node.auto')}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {t(o.nameKey)}
            </option>
          ))}
        </select>
      }
    />
  );
};
