import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TemplateDefinitionSchema, type TemplateDefinition } from '@/core/templates/registry';
import { PROJECT_SCHEMA_VERSION } from '@/lib/storage';

/**
 * Workflows as files on the server (CORE_CONTRACTS §10.1) — the way ComfyUI keeps a user's
 * workflows under `userdata/workflows/`. One JSON file per workflow, the same shape as a shipped
 * template plus a schema version and a timestamp, so a file here, a file in `templates/` and a file
 * someone shares are interchangeable. The id is the file name and is validated by the schema; the
 * path is built here and nowhere else, so a request can never name a file outside the directory.
 *
 * `current` is the graph on the canvas, autosaved; it is a workflow file like any other but is not
 * listed, the way an editor's unsaved buffer is not a document.
 */

export const CURRENT_WORKFLOW_ID = 'current';
export const MAX_WORKFLOW_BYTES = 4_000_000;

export interface WorkflowFile extends TemplateDefinition {
  schemaVersion: number;
  updatedAt: string;
}
export type WorkflowSummary = Pick<WorkflowFile, 'id' | 'name' | 'description' | 'category' | 'updatedAt'> & { nodes: number };

export function workflowsDir(): string {
  return path.resolve(process.cwd(), process.env.NODECINE_WORKFLOWS_DIR ?? '.nodecine/workflows');
}

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

function fileFor(id: string): string {
  if (!ID.test(id)) throw Object.assign(new Error(`invalid workflow id "${id}"`), { code: 'WORKFLOW_ID_INVALID' });
  const p = path.join(workflowsDir(), `${id}.json`);
  if (path.dirname(p) !== workflowsDir()) throw Object.assign(new Error('path escapes the workflows dir'), { code: 'WORKFLOW_ID_INVALID' });
  return p;
}

/** Validate an incoming definition and stamp it; `category` defaults to `mine`. */
export function toWorkflowFile(input: unknown, now = new Date()): WorkflowFile {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const def = TemplateDefinitionSchema.parse({ category: 'mine', ...raw });
  return { ...def, schemaVersion: PROJECT_SCHEMA_VERSION, updatedAt: now.toISOString() };
}

async function readFileAs(p: string): Promise<WorkflowFile | null> {
  let text: string;
  try {
    text = await readFile(p, 'utf8');
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') return null;
    throw e;
  }
  const doc = JSON.parse(text) as Partial<WorkflowFile>;
  // No migrators: a file from another schema version is not a workflow this app can open.
  if (typeof doc.schemaVersion === 'number' && doc.schemaVersion !== PROJECT_SCHEMA_VERSION) return null;
  const def = TemplateDefinitionSchema.parse(doc);
  return { ...def, schemaVersion: PROJECT_SCHEMA_VERSION, updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : new Date(0).toISOString() };
}

export async function readWorkflow(id: string): Promise<WorkflowFile | null> {
  return readFileAs(fileFor(id));
}

export async function listWorkflows(): Promise<WorkflowSummary[]> {
  const dir = workflowsDir();
  await mkdir(dir, { recursive: true });
  const out: WorkflowSummary[] = [];
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.json')) continue;
    const id = name.slice(0, -5);
    if (id === CURRENT_WORKFLOW_ID || !ID.test(id)) continue;
    try {
      const wf = await readFileAs(path.join(dir, name));
      if (wf) out.push({ id: wf.id, name: wf.name, description: wf.description, category: wf.category, updatedAt: wf.updatedAt, nodes: wf.graph.nodes.length });
    } catch {
      /* a hand-edited file that no longer parses is skipped, not fatal */
    }
  }
  return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** Atomic: written beside the target and renamed over it, so a crash never leaves half a file. */
export async function writeWorkflow(wf: WorkflowFile): Promise<WorkflowFile> {
  const target = fileFor(wf.id);
  const text = JSON.stringify(wf, null, 2);
  if (Buffer.byteLength(text) > MAX_WORKFLOW_BYTES) throw Object.assign(new Error('workflow is too large'), { code: 'WORKFLOW_TOO_LARGE' });
  await mkdir(workflowsDir(), { recursive: true });
  const tmp = `${target}.${process.pid}.${Date.now().toString(36)}.tmp`;
  await writeFile(tmp, text, 'utf8');
  await rename(tmp, target);
  return wf;
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const p = fileFor(id);
  try {
    await rm(p);
    return true;
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') return false;
    throw e;
  }
}

/** A file-name-safe id from a human name, suffixed so two saves with the same name do not collide. */
export function workflowIdFor(name: string, now = Date.now()): string {
  const base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'workflow';
  return `${base}-${now.toString(36)}`;
}
