'use client';
import React from 'react';
import { useNode, useStudio } from '@/store/useStudio';
import { frameOf } from '@/core/visual/frame';

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

/** A folding section in a node body: a title line with a count, open or closed. */
export const Section: React.FC<{ title: string; count?: number; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({ title, count, open, onToggle, children }) => (
  <div style={{ border: '1px solid var(--line)', borderRadius: 3, padding: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
    <div className="nc-k" style={{ cursor: 'pointer', color: open ? 'var(--accent-2)' : undefined, display: 'flex', gap: 6 }} onClick={onToggle}>
      <span>{open ? '▾' : '▸'} {title}</span>
      {count !== undefined && <span style={{ marginLeft: 'auto', color: 'var(--tx-3)' }}>{count}</span>}
    </div>
    {open && children}
  </div>
);
