import type { Graph } from '@/core/engine/graph';

/**
 * The language model a workflow writes with, chosen once for the whole workflow.
 *
 * It sits in the workflow's own settings (`graph.settings.llm`), so it is saved with the file, travels
 * with a template and is undone like any other edit. The workflow's agent thinks with it, and every node
 * that leaves its own model empty writes with it. A node that needs a different one — a model that can
 * search the web, say — still names its own.
 *
 * The run never sees an empty choice: the server fills it into each such node before the graph is run
 * (`withWorkflowModel`), so the model is part of the node's parameters, and of its signature — changing
 * the workflow's model runs those nodes again instead of handing back the old model's answers.
 */

export interface WorkflowModel {
  provider: string;
  settings: Record<string, unknown>;
}

const isModel = (v: unknown): v is WorkflowModel => !!v && typeof v === 'object' && typeof (v as WorkflowModel).provider === 'string' && !!(v as WorkflowModel).provider;

/**
 * The model this workflow writes with: the one set on it, else the one its nodes already name (a
 * workflow made before there was a shared model), else `fallback` — the first one this build ships.
 */
export function workflowModel(graph: Graph, fallback?: WorkflowModel | null): WorkflowModel | null {
  const set = graph.settings?.llm;
  if (isModel(set)) return { provider: set.provider, settings: set.settings ?? {} };
  const named = graph.nodes.find((n) => typeof n.params.llmProvider === 'string' && n.params.llmProvider);
  if (named) return { provider: named.params.llmProvider as string, settings: (named.params.llmSettings as Record<string, unknown> | undefined) ?? {} };
  return fallback ?? null;
}

export function setWorkflowModel(graph: Graph, model: WorkflowModel): Graph {
  return { ...graph, settings: { ...graph.settings, llm: { provider: model.provider, settings: model.settings } } };
}

/** Every node that leaves its model empty, given the workflow's. Untouched when there is none. */
export function withWorkflowModel(graph: Graph, fallback?: WorkflowModel | null): Graph {
  const model = workflowModel(graph, fallback);
  if (!model) return graph;
  let changed = false;
  const nodes = graph.nodes.map((n) => {
    if (n.params.llmProvider !== '') return n;
    changed = true;
    return { ...n, params: { ...n.params, llmProvider: model.provider, llmSettings: model.settings } };
  });
  return changed ? { ...graph, nodes } : graph;
}
