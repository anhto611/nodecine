'use client';
import React from 'react';
import type { Graph, NodeInstance } from '@/core/engine/graph';
import type { NodeRuntime } from '@/core/engine/state';
import type { VideoIR } from '@/contracts/types/ir';
import { frameOf } from '@/contracts/visual/frame';

/**
 * Everything a node body may ask of the Studio, and nothing more.
 *
 * Bodies used to reach into the Studio directly — its store, its dictionaries, its provider list —
 * while the Studio imported the bodies, so the two could only ever change together and a capsule
 * could not be understood without the app. The Studio now hands a body this, through context
 * (`components/node-host.tsx`), and a capsule imports only `capsules/sdk/`.
 *
 * Members named `use…` are React hooks: call them at the top of a component, the way their names say.
 */
export interface NodeHost {
  useGraph(): Graph;
  useNode(nodeId: string): NodeInstance | undefined;
  useRuntime(nodeId: string): NodeRuntime | undefined;
  /** The payload a node put on one of its outputs: its last run, or its pin before it has run. */
  useOutputPayload<T = unknown>(nodeId: string, port: string): T | undefined;
  /** The payload waiting on one of a node's inputs, from whatever is wired into it. */
  useInputPayload<T = unknown>(nodeId: string, port: string): T | undefined;
  useSetParams(): (nodeId: string, patch: Record<string, unknown>) => void;
  /** Whether a run is going, which step it is on, and the two things a body may start or stop. */
  useRun(): { running: boolean; step: { nodeId: string; step: number; total: number } | null; runNode(nodeId: string): void; cancel(): void };
  /** A film from the run history the person is looking at instead of the live one, or null. */
  useViewedFilm(): VideoIR | null;
  useLocale(): string;
  translate(locale: string, key: string, vars?: Record<string, string | number>): string;
  hasTranslation(key: string): boolean;
  /** The providers of one kind this build ships, for a picker. */
  providers(kind: 'llm' | 'tts'): { id: string; nameKey: string; defaultSettings: Record<string, unknown> }[];
}

const HostContext = React.createContext<NodeHost | null>(null);

export const NodeHostProvider: React.FC<{ host: NodeHost; children: React.ReactNode }> = ({ host, children }) => (
  <HostContext.Provider value={host}>{children}</HostContext.Provider>
);

export function useHost(): NodeHost {
  const host = React.useContext(HostContext);
  if (!host) throw new Error('a node body was drawn outside a NodeHostProvider');
  return host;
}

export const useGraph = (): Graph => useHost().useGraph();
export const useNode = (nodeId: string): NodeInstance | undefined => useHost().useNode(nodeId);
export const useRuntime = (nodeId: string): NodeRuntime | undefined => useHost().useRuntime(nodeId);
export const useOutputPayload = <T = unknown,>(nodeId: string, port: string): T | undefined => useHost().useOutputPayload<T>(nodeId, port);
export const useInputPayload = <T = unknown,>(nodeId: string, port: string): T | undefined => useHost().useInputPayload<T>(nodeId, port);
export const useRun = () => useHost().useRun();
export const useViewedFilm = (): VideoIR | null => useHost().useViewedFilm();
export const useLocale = (): string => useHost().useLocale();

/** A node's params, and a setter that patches them. */
export function useParams<T extends Record<string, unknown>>(nodeId: string): [T, (patch: Partial<T>) => void] {
  const host = useHost();
  const node = host.useNode(nodeId);
  const setParams = host.useSetParams();
  return [(node?.params ?? {}) as T, (patch) => setParams(nodeId, patch as Record<string, unknown>)];
}

/** The frame the workflow renders at, for every preview. */
export function useFrame(): { width: number; height: number } {
  const nodes = useHost().useGraph().nodes;
  return React.useMemo(() => frameOf({ nodes }), [nodes]);
}

/** `t()` bound to the current locale. */
export function useT() {
  const host = useHost();
  const locale = host.useLocale();
  return React.useCallback((key: string, vars?: Record<string, string | number>) => host.translate(locale, key, vars), [host, locale]);
}
export type { BodyProps } from './meta';
