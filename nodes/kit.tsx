'use client';
import { useNode, useStudio } from '@/store/useStudio';

/** What every node body receives, and the one hook they all use to read and patch their node's params. */
export type BodyProps = { nodeId: string };

export function useParams<T extends Record<string, unknown>>(nodeId: string): [T, (patch: Partial<T>) => void] {
  const node = useNode(nodeId);
  const setParams = useStudio((s) => s.setParams);
  return [(node?.params ?? {}) as T, (patch) => setParams(nodeId, patch as Record<string, unknown>)];
}
