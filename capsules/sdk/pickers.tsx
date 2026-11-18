'use client';
import React from 'react';
import { Kv, useT, stopFlow } from './ui';
import { useHost, useParams } from './host';

/**
 * The voice a node speaks with, chosen on the node itself. A model is not chosen here: the workflow
 * has one for all its nodes (`contracts/workflow-model.ts`).
 *
 * These were nodes of their own until 2026-09-12, wired in on a second kind of port, and the reason a
 * node could not run was reported on a different node from the one that failed. What is left of that
 * idea is this row: the node names what it needs, and probes it when it runs.
 */
export const ProviderPick: React.FC<{ nodeId: string; kind: 'tts'; optional?: boolean }> = ({ nodeId, kind, optional }) => {
  const t = useT();
  const field = 'ttsProvider';
  const [p, set] = useParams<Record<string, unknown>>(nodeId);
  const options = useHost().providers(kind);
  const current = String(p[field] ?? '');
  const settingsField = 'ttsSettings';

  // A node dropped from the library starts empty; offer the first one rather than an error.
  React.useEffect(() => {
    if (!optional && !current && options[0]) set({ [field]: options[0].id, [settingsField]: { ...options[0].defaultSettings } });
  }, [current, options, set, field, settingsField, optional]);

  return (
    <Kv
      k={t('node.ttsProvider')}
      v={
        <select
          className={`nc-select ${stopFlow}`}
          value={current}
          onChange={(e) => {
            const next = options.find((o) => o.id === e.target.value);
            set({ [field]: e.target.value, [settingsField]: { ...(next?.defaultSettings ?? {}) } });
          }}
        >
          {(optional || !current) && <option value="">—</option>}
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
