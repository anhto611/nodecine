'use client';
import React from 'react';
import { NodeHostProvider, type NodeHost } from '@/capsules/sdk/host';
import { providersOfKind } from '@/capsules/providers/installed';
import { hasTranslation, translate, type Locale } from '@/lib/i18n';
import { useInputPayload, useNode, useOutputPayload, useRuntime, useStudio } from '@/store/useStudio';

/**
 * The Studio as a node body sees it (`capsules/sdk/host.tsx`): the store, the dictionaries, the
 * provider list — handed down through context, so a capsule never imports the app.
 */
const studioHost: NodeHost = {
  useGraph: () => useStudio((s) => s.graph),
  useNode,
  useRuntime,
  useOutputPayload,
  useInputPayload,
  useSetParams: () => useStudio((s) => s.setParams),
  useRun: () => {
    const running = useStudio((s) => s.running);
    const step = useStudio((s) => s.step);
    const runNode = useStudio((s) => s.runNode);
    const cancel = useStudio((s) => s.cancel);
    return React.useMemo(() => ({ running, step, runNode: (id: string) => void runNode(id), cancel: () => void cancel() }), [running, step, runNode, cancel]);
  },
  useViewedRun: () => useStudio((s) => (s.viewingRun != null ? s.history.find((r) => r.seq === s.viewingRun) ?? null : null)),
  useLocale: () => useStudio((s) => s.locale),
  useOverlay: () => {
    const current = useStudio((s) => s.overlay);
    const setOverlay = useStudio((s) => s.setOverlay);
    return React.useMemo(() => ({ current, open: (nodeId: string, data?: unknown) => setOverlay({ nodeId, data }), close: () => setOverlay(null) }), [current, setOverlay]);
  },
  translate: (locale, key, vars) => translate(locale as Locale, key, vars),
  hasTranslation,
  providers: (kind) => providersOfKind(kind),
  action: async <T,>(id: string, args: unknown[]): Promise<T> => {
    const res = await fetch(`/api/node-actions/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ args }) });
    const body = (await res.json().catch(() => ({}))) as { result?: T; message?: string };
    if (!res.ok) throw new Error(body.message ?? `${id} failed (${res.status})`);
    return body.result as T;
  },
  uploadImage: async (file) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('could not read the file'));
      reader.readAsDataURL(file);
    });
    const res = await fetch('/api/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl }) });
    const body = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
    if (!res.ok || !body.url) throw new Error(body.message ?? `upload failed (${res.status})`);
    return body.url;
  },
};

export const StudioNodeHost: React.FC<{ children: React.ReactNode }> = ({ children }) => <NodeHostProvider host={studioHost}>{children}</NodeHostProvider>;
