import { getNodeType } from '@/core/nodes/definition';

/**
 * The node that holds a workflow's kit: one that puts out a composition and keeps its files itself.
 * Told by what the node is, not by its name, so nothing outside its capsule names it.
 */
export function holdsKit(type: string): boolean {
  const def = getNodeType(type);
  return !!def && def.outputs.some((p) => p.type === 'Composition') && 'files' in (def.defaultParams as Record<string, unknown>);
}

/**
 * A kit being built by a coding agent for a workflow's Composition node, as the browser follows it
 * (`server/contracts/kit-session.ts` runs it).
 */
export interface KitSession {
  id: string;
  agentId: string;
  nodeId: string;
  state: 'running' | 'done' | 'failed' | 'cancelled';
  /** `build` the first round, `repair` the rounds after NodeCine found problems, `check` in between. */
  phase: 'build' | 'check' | 'repair';
  round: number;
  startedAt: string;
  endedAt?: string;
  log: string[];
  /** The kit, once built and checked. */
  files?: Record<string, string>;
  /** What is still wrong with it, when the rounds ran out. */
  problems?: string[];
  /** What the coding agent said it did. */
  summary?: string;
  error?: string;
}
