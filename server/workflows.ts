import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TemplateDefinitionSchema, type TemplateDefinition } from '@/core/templates/registry';
import { PROJECT_SCHEMA_VERSION } from '@/lib/storage';
import { migrateDoc, stampVersions, type SavedDoc } from '@/core/engine/migrate';
import { ensureServerRegistrations } from '@/server/register';

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
  /** What had to change for this file to open today; absent when nothing did. */
  migrations?: { code: string; message: string; nodeId?: string }[];
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
  ensureServerRegistrations();
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const def = TemplateDefinitionSchema.parse({ category: 'mine', ...raw });
  const from = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : PROJECT_SCHEMA_VERSION;
  // An imported file is brought forward here, once, on its way to disk. Stamping it current without
  // migrating it would be worse than refusing it: the file would look right and be wrong.
  const { doc, notes } = migrateDoc({ ...def, schemaVersion: from } as SavedDoc);
  // Every node goes to disk carrying the version that wrote its parameters. A later build cannot
  // bring anything forward without knowing what it is looking at.
  return { ...def, graph: stampVersions(doc.graph), schemaVersion: PROJECT_SCHEMA_VERSION, updatedAt: now.toISOString(), ...(notes.length ? { migrations: notes } : {}) };
}

async function readFileAs(p: string): Promise<WorkflowFile | null> {
  let text: string;
  try {
    text = await readFile(p, 'utf8');
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') return null;
    throw e;
  }
  // Three different things can be wrong with a file, and only one of them means "there is no such
  // file". Collapsing all three into `null` is what made a workflow that would not open do nothing
  // at all when it was clicked: no message, no reason, no way to tell a stale file from a broken one.
  let doc: Partial<WorkflowFile>;
  try {
    doc = JSON.parse(text) as Partial<WorkflowFile>;
  } catch (e) {
    throw Object.assign(new Error(`this file is not JSON: ${e instanceof Error ? e.message : String(e)}`), { code: 'WORKFLOW_MALFORMED' });
  }
  // The node types have to be known before a graph can be brought forward against them.
  ensureServerRegistrations();
  const parsed = TemplateDefinitionSchema.safeParse(doc);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Object.assign(new Error(`${first?.path.join('.') || 'file'}: ${first?.message ?? 'not a workflow'}`), { code: 'WORKFLOW_MALFORMED' });
  }
  // Throws DocVersionUnsupportedError, which carries the same code the route already reports.
  const { doc: forward, notes } = migrateDoc({ ...parsed.data, schemaVersion: typeof doc.schemaVersion === 'number' ? doc.schemaVersion : PROJECT_SCHEMA_VERSION } as SavedDoc);
  return {
    ...parsed.data,
    graph: forward.graph,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : new Date(0).toISOString(),
    ...(notes.length ? { migrations: notes } : {}),
  };
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
