import type { Graph } from '../engine/graph';

/**
 * Template registry (CORE_CONTRACTS §10): `templateId → graph factory`. Empty in the core;
 * the core's own Static Script template and every pack register at startup.
 */
export type TemplateFactory = () => Graph;

const templates = new Map<string, TemplateFactory>();

export function registerTemplate(id: string, factory: TemplateFactory): void {
  templates.set(id, factory);
}

export function getTemplate(id: string): TemplateFactory | undefined {
  return templates.get(id);
}

export function listTemplateIds(): string[] {
  return [...templates.keys()];
}
