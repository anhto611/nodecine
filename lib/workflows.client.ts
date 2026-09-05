'use client';
import type { TemplateDefinition } from '@/core/templates/registry';
import type { Graph } from '@/core/engine/graph';

/** The browser's side of the workflow files (server/workflows.ts). Thin: every function is one request. */

export interface WorkflowSummary { id: string; name: TemplateDefinition['name']; description?: TemplateDefinition['description']; category: string; updatedAt: string; nodes: number }

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) throw Object.assign(new Error(data.message ?? data.error ?? `${url} failed (${res.status})`), { code: data.error ?? 'WORKFLOW_INVALID' });
  return data;
}
const post = (body: unknown, method = 'POST'): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const workflowsApi = {
  list: () => json<{ workflows: WorkflowSummary[] }>('/api/workflows').then((r) => r.workflows),
  read: (id: string) => json<TemplateDefinition>(`/api/workflows/${encodeURIComponent(id)}`),
  save: (def: Omit<TemplateDefinition, 'category'> & { category?: string }) => json<TemplateDefinition>('/api/workflows', post(def)),
  replace: (id: string, def: Omit<TemplateDefinition, 'id' | 'category'> & { category?: string }) => json<TemplateDefinition>(`/api/workflows/${encodeURIComponent(id)}`, post(def, 'PUT')),
  remove: (id: string) => json<{ deleted: boolean }>(`/api/workflows/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  fromVideo: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return json<TemplateDefinition>('/api/workflows/from-video', { method: 'POST', body: form });
  },
};
