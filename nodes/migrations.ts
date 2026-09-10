import { registerDocMigration, type SavedDoc } from '@/core/engine/migrate';

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

export function registerDocMigrations(): void {
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
