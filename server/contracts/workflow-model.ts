import { listLLMProviders } from '@/contracts/providers/registry';
import type { WorkflowModel } from '@/contracts/workflow-model';
import { ensureServerRegistrations } from './register';

/**
 * The model a workflow writes with when neither it nor any of its nodes names one: the first this
 * build ships, set up as its own schema says — the same one a node's picker offers first.
 */
export function firstModel(): WorkflowModel | null {
  ensureServerRegistrations();
  const first = listLLMProviders()[0];
  return first ? { provider: first.id, settings: { ...first.defaultSettings } } : null;
}
