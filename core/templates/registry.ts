import { z } from 'zod';
import type { Graph } from '../engine/graph';

/**
 * Template registry (CORE_CONTRACTS §10): the pre-wired graphs the Template Browser offers.
 *
 * A template is data — a saved graph plus a name — of exactly the shape `lib/storage.ts` writes when
 * a user saves their own project. It names node types by string and owns nothing, so one can be
 * shipped in the repo, saved from the canvas, or pasted in from someone else, and the registry
 * cannot tell the difference. The core keeps the table empty; `templates/` fills it at startup.
 */

/** A string, or one per locale. A user-saved template has the first; a shipped one the second. */
export const LocalizedTextSchema = z.union([z.string(), z.record(z.string(), z.string())]);
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

const NodeInstanceSchema = z.object({
  id: z.string().min(1),
  type: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
  params: z.record(z.string(), z.unknown()),
  bypassed: z.boolean(),
  position: z.object({ x: z.number(), y: z.number() }),
});
const EdgeSchema = z.object({ id: z.string().min(1), source: z.string(), sourcePort: z.string(), target: z.string(), targetPort: z.string() });
export const GraphSchema = z.object({ nodes: z.array(NodeInstanceSchema), edges: z.array(EdgeSchema) });

export const TemplateDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  name: LocalizedTextSchema,
  description: LocalizedTextSchema.optional(),
  /** Grouping in the browser's sidebar. */
  category: z.string().min(1),
  graph: GraphSchema,
});
export type TemplateDefinition = z.infer<typeof TemplateDefinitionSchema>;

const templates = new Map<string, TemplateDefinition>();

/** Registers a template; the shape is checked so a bad file fails here, not in the browser. */
export function registerTemplate(input: unknown): TemplateDefinition {
  const def = TemplateDefinitionSchema.parse(input);
  templates.set(def.id, def);
  return def;
}

export function getTemplate(id: string): TemplateDefinition | undefined {
  return templates.get(id);
}

export function listTemplates(): TemplateDefinition[] {
  return [...templates.values()];
}

/** A fresh copy of the graph, so editing the canvas never edits the template. */
export function templateGraph(def: TemplateDefinition): Graph {
  return structuredClone(def.graph);
}

export function localized(text: LocalizedText | undefined, locale: string, fallback = ''): string {
  if (text === undefined) return fallback;
  if (typeof text === 'string') return text;
  return text[locale] ?? text.en ?? Object.values(text)[0] ?? fallback;
}

/** Test-only. */
export function _resetTemplates(): void {
  templates.clear();
}
