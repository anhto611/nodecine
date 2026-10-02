'use client';
import type { LocalizedText, WorkflowDocument } from '@/core/engine/document';
import type { TemplateGroup } from '@/templates/.generated/descriptors';

/** The browser's side of the workflow files (server/workflows.ts). Thin: every function is one request. */

export interface WorkflowSummary {
  id: string;
  name: WorkflowDocument['name'];
  description?: WorkflowDocument['description'];
  category: string;
  updatedAt: string;
  nodes: number;
}
export type TemplateSummary = WorkflowSummary & { group: TemplateGroup; thumbnail: string; tagline: LocalizedText; tags: LocalizedText[] };

/** A file that had to be brought forward reports what changed, so the person is told, not surprised. */
export type WorkflowRead = WorkflowDocument & { migrations?: { code: string; message: string; nodeId?: string }[] };

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) throw Object.assign(new Error(data.message ?? data.error ?? `${url} failed (${res.status})`), { code: data.error ?? 'WORKFLOW_INVALID' });
  return data;
}
const post = (body: unknown, method = 'POST'): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const workflowsApi = {
  list: () => json<{ workflows: WorkflowSummary[] }>('/api/workflows').then((r) => r.workflows),
  read: (id: string) => json<WorkflowRead>(`/api/workflows/${encodeURIComponent(id)}`),
  save: (def: Omit<WorkflowDocument, 'category'> & { category?: string }) => json<WorkflowDocument>('/api/workflows', post(def)),
  replace: (id: string, def: Omit<WorkflowDocument, 'id' | 'category'> & { category?: string }) => json<WorkflowDocument>(`/api/workflows/${encodeURIComponent(id)}`, post(def, 'PUT')),
  remove: (id: string) => json<{ deleted: boolean }>(`/api/workflows/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  fromVideo: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return json<WorkflowDocument>('/api/workflows/from-video', { method: 'POST', body: form });
  },
};

export const templatesApi = {
  list: () => json<{ templates: TemplateSummary[] }>('/api/templates').then((response) => response.templates),
  read: (id: string) => json<WorkflowRead>(`/api/templates/${encodeURIComponent(id)}`),
};
