import { NODE_ACTIONS } from '@/capsules/nodes/.generated/server';
import { ensureServerRegistrations } from './register';

/**
 * What a node body asks the server for while a person edits the node, outside any run. Only what a
 * capsule lists as an action is reachable; its services stay for runs.
 */
export async function runNodeAction(id: string, args: unknown[]): Promise<unknown> {
  ensureServerRegistrations();
  const actions = Object.assign({}, ...NODE_ACTIONS) as Record<string, (...a: unknown[]) => Promise<unknown>>;
  const action = actions[id];
  if (!action) throw Object.assign(new Error(`unknown node action ${id}`), { code: 'ACTION_UNKNOWN' });
  return action(...args);
}
