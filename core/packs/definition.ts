/**
 * What a template pack is, from the core's point of view (CORE_CONTRACTS §10).
 *
 * The core never imports a pack. It defines this shape, and the app hands it a list of packs to
 * install. Everything a pack contributes — nodes, scene schemas, scene renderers, templates, server
 * handlers, display strings — arrives through these hooks, so adding a pack touches the pack folder
 * and nothing else.
 */

export interface PackDefinition {
  /** Prefix for the pack's node types and scene types, e.g. `github-showcase`. */
  id: string;
  /** Human-readable name for the node library group. Falls back to the id. */
  displayName?: string;
  /**
   * Everything that must exist on both the client and the server: scene schemas, node types,
   * template graphs. Must not import React or an engine, because the server calls it too.
   */
  register(): void;
  /** Handlers for `services.packRequest`; called only on the server. */
  registerServer?(): void;
  /** Display strings by locale, merged into the dictionaries at install time. */
  locales?: Record<string, Record<string, string>>;
}

const installed: PackDefinition[] = [];

/** Install a pack. Idempotent per id, so a double bootstrap is harmless. */
export function installPack(pack: PackDefinition): void {
  if (installed.some((p) => p.id === pack.id)) return;
  installed.push(pack);
  pack.register();
}

export function listInstalledPacks(): readonly PackDefinition[] {
  return installed;
}

export function getInstalledPack(id: string): PackDefinition | undefined {
  return installed.find((p) => p.id === id);
}

/** Test-only. */
export function _resetInstalledPacks(): void {
  installed.length = 0;
}
