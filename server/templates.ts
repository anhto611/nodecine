import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { LocalizedText } from '@/core/engine/document';
import { TEMPLATES } from '@/templates/.generated/descriptors';
import { workflowStore, type WorkflowFile, type WorkflowSummary } from './workflows';

export type TemplateSummary = WorkflowSummary & {
  group: 'video';
  thumbnail: string;
  tagline: LocalizedText;
  tags: LocalizedText[];
};

/**
 * One folder per template, named by its id: the graph, the card art and the build script stay
 * together, and the list of them is discovered from those folders (`scripts/discover-templates.mjs`)
 * rather than written here. An id that is not in the list is a miss, never a path this module builds
 * from the request.
 */
const BY_ID = new Map(TEMPLATES.map((template) => [template.id, template]));

const IMAGE_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/** `templates/<id>/`: the only place this module reads a template's files from. */
function templateDir(id: string): string {
  return path.join(process.cwd(), 'templates', id);
}

/** What the gallery card points at, served by `app/api/templates/[id]/thumbnail`. */
export function thumbnailUrl(id: string): string {
  return `/api/templates/${encodeURIComponent(id)}/thumbnail`;
}

/**
 * The card art a route may serve, or null when the id is not a template this build ships. The id is
 * looked up before any path is built and the file name comes from the manifest, so a request can
 * never name a file of its own.
 */
export function thumbnailFile(id: string): { path: string; type: string } | null {
  const template = BY_ID.get(id);
  if (!template) return null;
  const file = path.join(templateDir(id), template.thumbnail);
  return { path: file, type: IMAGE_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' };
}

export async function readTemplate(id: string, prepare: () => void): Promise<WorkflowFile | null> {
  const entry = BY_ID.get(id);
  if (!entry) return null;
  const raw = JSON.parse(await readFile(path.join(templateDir(id), entry.workflow), 'utf8')) as Record<string, unknown>;
  return workflowStore(prepare).toWorkflowFile({ ...raw, id, category: 'template' });
}

export async function listTemplates(prepare: () => void): Promise<TemplateSummary[]> {
  const summaries: TemplateSummary[] = [];
  for (const entry of BY_ID.values()) {
    const doc = (await readTemplate(entry.id, prepare))!;
    summaries.push({ id: entry.id, name: doc.name, description: doc.description, category: 'template', updatedAt: doc.updatedAt, nodes: doc.graph.nodes.length, group: entry.group, thumbnail: thumbnailUrl(entry.id), tagline: entry.tagline, tags: entry.tags });
  }
  return summaries;
}
