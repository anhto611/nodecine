'use client';
import type { AgentTurn } from '@/contracts/agent/actions';
import type { AgentChat, NodeFocus, RuntimeSummary } from '@/contracts/agent/chat';
import type { SampleProfile } from '@/contracts/agent/sample';
import type { KitSession } from '@/contracts/agent/kit';
import type { Graph } from '@/core/engine/graph';

/** The browser's side of a workflow's agent (`app/api/agent/[id]`). One request per function. */

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string; fix?: string };
  if (!res.ok) throw Object.assign(new Error(data.message ?? data.error ?? `${url} failed (${res.status})`), { code: data.error ?? 'AGENT_FAILED', ...(data.fix ? { fix: data.fix } : {}) });
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
  /** A sample video attached to this message (`sample` returned it). */
  sample?: string;
}

export const agentApi = {
  read: (id: string) => json<AgentChat>(url(id)),
  turn: (id: string, req: TurnRequest) => json<{ chat: AgentChat; turn: AgentTurn | null }>(url(id), body(req, 'POST')),
  /** Stop the turn being answered; its own request then comes back with the stop recorded. */
  cancel: (id: string) => json<{ cancelled: boolean }>(url(id), body({ cancel: true }, 'PATCH')),
  /** `to` takes `from`'s conversation, unless it already has one of its own. */
  adopt: (to: string, from: string, mode: 'move' | 'copy') => json<AgentChat>(url(to), body({ from, mode }, 'PATCH')),
  clear: (id: string) => json<AgentChat>(url(id), { method: 'DELETE' }),
  /** Read a sample video: about two minutes for a 30-second film the first time, at once after that. */
  sample: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return json<SampleProfile>(`${url(id)}/sample`, { method: 'POST', body: form });
  },
  /** Have a coding agent build a kit for a Composition node; answered at once with the session to follow. */
  kitStart: (id: string, req: { nodeId: string; request: string; graph: Graph; sample?: string }) => json<KitSession>(`${url(id)}/kit`, body(req, 'POST')),
  kitRead: (id: string, session: string) => json<KitSession>(`${url(id)}/kit?session=${encodeURIComponent(session)}`),
  kitCancel: (id: string, session: string) => json<{ cancelled: boolean }>(`${url(id)}/kit?session=${encodeURIComponent(session)}`, { method: 'DELETE' }),
  /** The same, for a video at a link: fetched by the server first. */
  sampleLink: (id: string, link: string) => json<SampleProfile>(`${url(id)}/sample`, body({ url: link }, 'POST')),
};
