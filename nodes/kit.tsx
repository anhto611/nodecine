'use client';
import React from 'react';
import { useNode, useStudio } from '@/store/useStudio';
import { frameOf } from '@/contracts/visual/frame';

/** What every node body receives, and the one hook they all use to read and patch their node's params. */
export type BodyProps = { nodeId: string };

export function useParams<T extends Record<string, unknown>>(nodeId: string): [T, (patch: Partial<T>) => void] {
  const node = useNode(nodeId);
  const setParams = useStudio((s) => s.setParams);
  return [(node?.params ?? {}) as T, (patch) => setParams(nodeId, patch as Record<string, unknown>)];
}

/** The frame the workflow renders at (the Illustrator's ratio), for every preview. */
export function useFrame(): { width: number; height: number } {
  const nodes = useStudio((s) => s.graph.nodes);
  return React.useMemo(() => frameOf({ nodes }), [nodes]);
}
