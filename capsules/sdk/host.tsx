'use client';
import React from 'react';
import type { Graph, NodeInstance } from '@/core/engine/graph';
import type { NodeRuntime } from '@/core/engine/state';
import type { RunRecord } from '@/contracts/history';

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
  /** A run from the history the person is looking at instead of the live one, or null. */
  useViewedRun(): RunRecord | null;
  useLocale(): string;
  translate(locale: string, key: string, vars?: Record<string, string | number>): string;
  hasTranslation(key: string): boolean;
  /**
   * The dialog a capsule registers as its overlay (manifest `overlay`), drawn above the canvas rather
   * than inside the node: which node opened it and with what, and how to open or close it.
   */
  useOverlay(): { current: { nodeId: string; data?: unknown } | null; open(nodeId: string, data?: unknown): void; close(): void };
  /** Ask the server for one of this capsule's actions (`capsule/name` in its manifest's `actions`). */
  action<T = unknown>(id: string, args: unknown[]): Promise<T>;
  /** Keep a picture the person chose as a file this machine holds, and return its URL. */
  uploadImage(file: File): Promise<string>;
  /** The same for a file too big to carry as text — a recorded clip — sent as itself. */
  uploadFile(file: File): Promise<string>;
  /** The providers of one kind this build ships, for a picker. */
  providers(kind: 'llm' | 'tts'): { id: string; nameKey: string; defaultSettings: Record<string, unknown> }[];
}

const HostContext = React.createContext<NodeHost | null>(null);

export const NodeHostProvider: React.FC<{ host: NodeHost; children: React.ReactNode }> = ({ host, children }) => <HostContext.Provider value={host}>{children}</HostContext.Provider>;

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
export const useViewedRun = (): RunRecord | null => useHost().useViewedRun();
export const useLocale = (): string => useHost().useLocale();
export const useOverlay = () => useHost().useOverlay();

/** A node's params, and a setter that patches them. */
export function useParams<T extends Record<string, unknown>>(nodeId: string): [T, (patch: Partial<T>) => void] {
  const host = useHost();
  const node = host.useNode(nodeId);
  const setParams = host.useSetParams();
  return [(node?.params ?? {}) as T, (patch) => setParams(nodeId, patch as Record<string, unknown>)];
}

/** `t()` bound to the current locale. */
export function useT() {
  const host = useHost();
  const locale = host.useLocale();
  return React.useCallback((key: string, vars?: Record<string, string | number>) => host.translate(locale, key, vars), [host, locale]);
}
export type { BodyProps } from './meta';
