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
  useViewedFilm: () => useStudio((s) => (s.viewingRun != null ? s.history.find((r) => r.seq === s.viewingRun)?.ir ?? null : null)),
  useLocale: () => useStudio((s) => s.locale),
  translate: (locale, key, vars) => translate(locale as Locale, key, vars),
  hasTranslation,
  providers: (kind) => providersOfKind(kind),
};

export const StudioNodeHost: React.FC<{ children: React.ReactNode }> = ({ children }) => <NodeHostProvider host={studioHost}>{children}</NodeHostProvider>;
