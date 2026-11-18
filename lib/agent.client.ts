'use client';
import type { AgentTurn } from '@/contracts/agent/actions';
import type { AgentChat, NodeFocus, RuntimeSummary } from '@/contracts/agent/chat';
import type { Graph } from '@/core/engine/graph';

/** The browser's side of a workflow's agent (`app/api/agent/[id]`). One request per function. */

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) throw Object.assign(new Error(data.message ?? data.error ?? `${url} failed (${res.status})`), { code: data.error ?? 'AGENT_FAILED' });
  return data;
}
const body = (value: unknown, method: string): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
const url = (id: string) => `/api/agent/${encodeURIComponent(id)}`;

export interface TurnRequest {
  message: { role: 'user' | 'event'; text: string };
  workflowName: string;
  graph: Graph;
  runtimes: Record<string, RuntimeSummary>;
  running: boolean;
  focus?: NodeFocus;
}

export const agentApi = {
  read: (id: string) => json<AgentChat>(url(id)),
  turn: (id: string, req: TurnRequest) => json<{ chat: AgentChat; turn: AgentTurn | null }>(url(id), body(req, 'POST')),
  /** Stop the turn being answered; its own request then comes back with the stop recorded. */
  cancel: (id: string) => json<{ cancelled: boolean }>(url(id), body({ cancel: true }, 'PATCH')),
  /** `to` takes `from`'s conversation, unless it already has one of its own. */
  adopt: (to: string, from: string, mode: 'move' | 'copy') => json<AgentChat>(url(to), body({ from, mode }, 'PATCH')),
  clear: (id: string) => json<AgentChat>(url(id), { method: 'DELETE' }),
};
