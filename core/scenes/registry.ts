import type { ZodTypeAny } from 'zod';

/**
 * Scene registry (CORE_CONTRACTS §4): the core keeps an empty table
 * `sceneType → { schema, renderers }`. Renderers are `unknown` at this layer —
 * the core imports neither React nor any engine. Packs and engines register
 * themselves at startup.
 */

export interface SceneDefinition {
  sceneType: string;
  propsSchema: ZodTypeAny;
  /** engineId → renderer (a React component for Remotion, a draw function for Hyperframes, …) */
  renderers: Record<string, unknown>;
}

const scenes = new Map<string, SceneDefinition>();

export function registerScene(
  def: Omit<SceneDefinition, 'renderers'> & { renderers?: Record<string, unknown> },
): void {
  const existing = scenes.get(def.sceneType);
  scenes.set(def.sceneType, {
    sceneType: def.sceneType,
    propsSchema: def.propsSchema,
    renderers: { ...(existing?.renderers ?? {}), ...(def.renderers ?? {}) },
  });
}

/** An engine registers a renderer for a scene type whose schema already exists. */
export function registerSceneRenderer(sceneType: string, engineId: string, renderer: unknown): void {
  const def = scenes.get(sceneType);
  if (!def) {
    throw new Error(`No schema registered for scene type "${sceneType}"; register the schema before its renderer.`);
  }
  def.renderers[engineId] = renderer;
}

export function getScene(sceneType: string): SceneDefinition | undefined {
  return scenes.get(sceneType);
}

export function hasScene(sceneType: string): boolean {
  return scenes.has(sceneType);
}

export function hasRenderer(sceneType: string, engineId: string): boolean {
  return scenes.get(sceneType)?.renderers[engineId] !== undefined;
}

export function listScenes(): SceneDefinition[] {
  return [...scenes.values()];
}

/** Scene types in the list that the engine has no renderer for — basis for ENGINE_SCENE_UNSUPPORTED. */
export function missingRenderers(sceneTypes: string[], engineId: string): string[] {
  return [...new Set(sceneTypes)].filter((t) => !hasRenderer(t, engineId));
}

/** Test-only. */
export function _resetSceneRegistry(): void {
  scenes.clear();
}
