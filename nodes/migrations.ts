import { registerDocMigration, registerGraphStep, registerResourceFold, type SavedDoc } from '@/core/engine/migrate';
import type { Graph } from '@/core/engine/graph';

/**
 * How a saved document written by an older build becomes one this build can open. This is the one
 * file allowed to name node types that no longer exist beside ones that do, because that is exactly
 * what a migration is: a sentence about history. Core holds the mechanism and knows none of it.
 *
 * A step is written once, when the format is bumped, and then never touched again. `core/__tests__`
 * keeps a real file of each old format so a step that stops working fails the build.
 */

/** One node per provider became one node per port type, the way ComfyUI's Load Checkpoint works. */
const PROVIDER_NODES_V2: Record<string, { type: string; providerId: string }> = {
  'core/system-tts-provider': { type: 'core/tts-provider', providerId: 'system-tts' },
  'core/piper-provider': { type: 'core/tts-provider', providerId: 'piper' },
  'core/claude-code-provider': { type: 'core/llm-provider', providerId: 'claude-code' },
};

/**
 * A model, a voice and an engine were nodes of their own until 2026-09-12, wired into everything
 * that used them. Each is a setting on the node that needs it now (CORE_CONTRACTS §1.3), so a saved
 * graph has them folded onto their consumers and the four nodes, with every wire, taken out.
 */
function registerResourceFolds(): void {
  registerResourceFold('core/llm-provider', (p) => ({ llmProvider: p.providerId ?? '', llmSettings: p.settings ?? {} }));
  registerResourceFold('core/tts-provider', (p) => ({ ttsProvider: p.providerId ?? '', ttsSettings: p.settings ?? {} }));
  registerResourceFold('core/hyperframes-engine', (p) => ({ engineId: 'hyperframes', engineSettings: p ?? {} }));
  registerResourceFold('core/remotion-engine', (p) => ({ engineId: 'remotion', engineSettings: p ?? {} }));
}

/**
 * Captions were a node of their own until 2026-09-12, and they could only ever sit behind Transcribe:
 * nothing else produces a voice carrying words. They are a second port on that node now.
 *
 * A saved graph keeps the transcribe node; the captions node's line length moves onto it and
 * anything that read its `captions` port is re-pointed at the same port on the transcribe node.
 */
function mergeCaptionsIntoTranscribe(graph: Graph, notes: { nodeId?: string; code: string; message: string }[]): Graph {
  const captions = graph.nodes.filter((n) => n.type === 'core/captions');
  if (!captions.length) return graph;
  const transcribes = graph.nodes.filter((n) => n.type === 'core/transcribe');
  // Each captions node belongs to the transcribe wired into it; one with none joins the first there is.
  const hostOf = (id: string) => {
    const wire = graph.edges.find((e) => e.target === id && e.targetPort === 'voiceover');
    return transcribes.find((n) => n.id === wire?.source) ?? transcribes[0];
  };
  const moved = new Map<string, string>();
  for (const c of captions) {
    const host = hostOf(c.id);
    if (host) moved.set(c.id, host.id);
  }
  // A captions node with no transcribe anywhere has nowhere to go; leaving it alone would leave an
  // unknown type behind, so it goes and its wires go with it. Nothing downstream could run anyway.
  const gone = new Set(captions.map((c) => c.id));
  const chars = (id: string) => (graph.nodes.find((n) => n.id === id)?.params as { maxChars?: unknown } | undefined)?.maxChars;
  const nodes = graph.nodes.filter((n) => !gone.has(n.id)).map((n) => {
    const from = [...moved].find(([, host]) => host === n.id)?.[0];
    if (!from) return n;
    notes.push({ nodeId: n.id, code: 'NODE_REPLACED', message: '"core/captions" moved onto "core/transcribe" in 2026-09-12' });
    const maxChars = chars(from);
    return { ...n, params: { ...n.params, ...(typeof maxChars === 'number' ? { maxChars } : {}) } };
  });
  const edges = graph.edges
    // The wire that fed the captions node is the merge itself; it has nothing left to join.
    .filter((e) => !(gone.has(e.target) && e.targetPort === 'voiceover'))
    .map((e) => (gone.has(e.source) ? { ...e, source: moved.get(e.source) ?? e.source } : e))
    .filter((e) => !gone.has(e.source) && !gone.has(e.target));
  return { nodes, edges };
}

export function registerDocMigrations(): void {
  registerResourceFolds();
  registerGraphStep(mergeCaptionsIntoTranscribe);
  registerDocMigration(1, (doc: SavedDoc): SavedDoc => ({
    ...doc,
    graph: {
      ...doc.graph,
      nodes: doc.graph.nodes.map((n) => {
        const moved = PROVIDER_NODES_V2[n.type];
        if (!moved) return n;
        // The vendor moved into `providerId`, and what used to be loose parameters became `settings`.
        const { defaultVoice, rate, model } = n.params as Record<string, unknown>;
        const settings = moved.providerId === 'claude-code'
          ? (model !== undefined ? { model } : {})
          : { rate: typeof rate === 'number' ? rate : 1 };
        return { ...n, type: moved.type, params: { providerId: moved.providerId, settings, ...(defaultVoice !== undefined ? { defaultVoice } : {}) } };
      }),
    },
  }));
}
