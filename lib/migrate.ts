import type { Graph } from '@/core/engine/graph';
import { migrateBlocksV6, migrateLookV4 } from './storage.v4';
import githubShowcaseJson from '@/templates/github-showcase.json';
import quoteCardsJson from '@/templates/quote-cards.json';

/**
 * Project document versions and the migrations between them. Isomorphic: the browser runs them on
 * what it finds in localStorage, the server on workflow files it reads back (EXECUTION_ENGINE §7.3).
 */
export const PROJECT_SCHEMA_VERSION = 6;

export interface ProjectDoc {
  schemaVersion: number;
  name: string;
  graph: Graph;
}

/** One node per provider became one node per port type; a saved graph is rewritten on load. */
const PROVIDER_NODE_V2: Record<string, { type: string; providerId: string }> = {
  'core/system-tts-provider': { type: 'core/tts-provider', providerId: 'system-tts' },
  'core/piper-provider': { type: 'core/tts-provider', providerId: 'piper' },
  'core/claude-code-provider': { type: 'core/llm-provider', providerId: 'claude-code' },
};

/**
 * Version 3: the two per-video directors became parameters of the one core director. What each had
 * hardcoded — brief, theme, scene slots, fact bindings — is read from the shipped template that
 * replaced it, so a saved graph ends up exactly where a fresh one would.
 */
const directorParamsFrom = (template: { graph: { nodes: { type: string; params: Record<string, unknown> }[] } }) =>
  template.graph.nodes.find((n) => n.type === 'core/ai-director')!.params;
const DIRECTOR_V3: Record<string, (old: Record<string, unknown>) => Record<string, unknown>> = {
  'github-showcase/ai-director': (old) => ({
    ...directorParamsFrom(githubShowcaseJson),
    outputLanguage: (old.outputLanguage as string | undefined) ?? 'auto',
  }),
  'quote-cards/quote-director': (old) => {
    const base = directorParamsFrom(quoteCardsJson);
    const beats = (base.beats as { blocks: string[]; count: number }[]).map((b) =>
      b.blocks.includes('quote') && typeof old.count === 'number' ? { ...b, count: old.count } : { ...b });
    return { ...base, beats, outputLanguage: (old.outputLanguage as string | undefined) ?? 'auto' };
  },
};

export function migrateProject(doc: ProjectDoc): ProjectDoc {
  let graph = doc.graph;
  if (doc.schemaVersion < 2) {
    graph = {
      ...graph,
      nodes: graph.nodes.map((n) => {
        const moved = PROVIDER_NODE_V2[n.type];
        if (!moved) return n;
        const { defaultVoice, rate, model, ...rest } = n.params as Record<string, unknown>;
        void rest;
        const settings = moved.providerId === 'claude-code' ? { ...(model !== undefined ? { model } : {}) } : { rate: (rate as number) ?? 1 };
        return { ...n, type: moved.type, params: { providerId: moved.providerId, settings, ...(defaultVoice !== undefined ? { defaultVoice } : {}) } };
      }),
    };
  }
  if (doc.schemaVersion < 3) {
    const quoteDirectors = new Set(graph.nodes.filter((n) => n.type === 'quote-cards/quote-director').map((n) => n.id));
    graph = {
      nodes: graph.nodes.map((n) => {
        const convert = DIRECTOR_V3[n.type];
        return convert ? { ...n, type: 'core/ai-director', params: convert(n.params) } : n;
      }),
      // The quote director took its subject on `topic`; the core director calls that port `source`.
      edges: graph.edges.map((e) => (quoteDirectors.has(e.target) && e.targetPort === 'topic' ? { ...e, targetPort: 'source' } : e)),
    };
  }
  if (doc.schemaVersion < 4) graph = migrateLookV4(graph);
  // Version 5: the GitHub fetcher moved from `extras/` into the core; the `extras/` layer is gone.
  if (doc.schemaVersion < 5) graph = { ...graph, nodes: graph.nodes.map((n) => (n.type === 'github-showcase/github-fetcher' ? { ...n, type: 'core/github-fetcher' } : n)) };
  if (doc.schemaVersion < 6) graph = migrateBlocksV6(graph);
  return { ...doc, graph, schemaVersion: PROJECT_SCHEMA_VERSION };
}

