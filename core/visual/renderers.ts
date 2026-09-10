import { ErrorCode } from '../errors';
import type { BlockReason } from '../nodes/definition';
import { SCENE_FORMAT, type EngineRef } from '../types/payloads';

/**
 * Which engines can draw which scene-code format (CORE_CONTRACTS §2.8, §4). Every scene of an IR is
 * `html-gsap`; an engine registers one renderer per format it understands, and the output nodes
 * stop by capability when the chosen engine lacks one. The core imports no engine: renderers are
 * `unknown` here, a React component for Remotion, a mount function for Hyperframes.
 */

const table = new Map<string, Map<string, unknown>>();

export function registerCodeRenderer(format: string, engineId: string, renderer: unknown): void {
  let byEngine = table.get(format);
  if (!byEngine) table.set(format, (byEngine = new Map()));
  byEngine.set(engineId, renderer);
}

export function getCodeRenderer(format: string, engineId: string): unknown {
  return table.get(format)?.get(engineId);
}

export function hasCodeRenderer(format: string, engineId: string): boolean {
  return table.get(format)?.has(engineId) ?? false;
}

/**
 * Why an output node cannot go ahead: it has a film to show and an engine that cannot draw it.
 * Every node that puts an IR in front of an engine asks the same question, and two of them had the
 * same five lines — which they could not share, because a capsule may not import a capsule.
 */
export function unsupportedSceneBlock(engine: EngineRef | undefined, hasFilm: boolean): BlockReason | null {
  if (!hasFilm || !engine) return null;
  const missing = missingCodeRenderers([SCENE_FORMAT], engine.engineId);
  return missing.length
    ? { kind: 'capability', code: ErrorCode.ENGINE_SCENE_UNSUPPORTED, message: `${engine.displayName} has no renderer for: ${missing.join(', ')}` }
    : null;
}

/** Formats in the list the engine cannot draw — basis for ENGINE_SCENE_UNSUPPORTED. */
export function missingCodeRenderers(formats: string[], engineId: string): string[] {
  return [...new Set(formats)].filter((f) => !hasCodeRenderer(f, engineId));
}

/** Test-only. */
export function _resetCodeRenderers(): void {
  table.clear();
}
