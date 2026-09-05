import type { Graph } from '../engine/graph';

/**
 * Template registry (CORE_CONTRACTS §10): the pre-wired graphs the Template Browser offers.
 * Empty in the core; the core's own Static Script graph and every pack register at startup, and the
 * browser reads this list rather than carrying a hard-coded one.
 */

export interface TemplateDefinition {
  id: string;
  /** Dictionary key for the name, so a pack can ship its own translations. */
  nameKey: string;
  descriptionKey?: string;
  /** Grouping in the browser's sidebar: `core`, or a pack id, or a category key. */
  category: string;
  /** Shown on the card; the graph is built lazily so this is declared, not counted. */
  nodeCount: number;
  build: () => Graph;
}

const templates = new Map<string, TemplateDefinition>();

export function registerTemplate(def: TemplateDefinition): void {
  templates.set(def.id, def);
}

export function getTemplate(id: string): TemplateDefinition | undefined {
  return templates.get(id);
}

export function listTemplates(): TemplateDefinition[] {
  return [...templates.values()];
}

/** Test-only. */
export function _resetTemplates(): void {
  templates.clear();
}
