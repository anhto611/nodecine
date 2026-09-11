import { ErrorCode } from '../errors';
import type { BlockReason } from '../nodes/definition';
import type { EngineRef } from '../types/payloads';
import { REQUIRED_TRANSITIONS, type VideoIR } from '../types/ir';
import { missingCodeRenderers } from './renderers';

/**
 * Which engines can draw which transition, by name (docs/IR_V3.md §5.4). The same shape as the
 * renderer table: empty in the core, filled by each engine at startup, asked by the output nodes
 * before a film is put in front of an engine. What an engine registers is its own — a snippet of
 * timeline code for HyperFrames, a presentation for Remotion — and `unknown` here. The four names
 * in `REQUIRED_TRANSITIONS` are the ones every engine must register, so a version-2 film migrated
 * forward plays everywhere.
 */

const table = new Map<string, Map<string, unknown>>();

export function registerTransition(name: string, engineId: string, impl: unknown): void {
  let byEngine = table.get(name);
  if (!byEngine) table.set(name, (byEngine = new Map()));
  byEngine.set(engineId, impl);
}

export function getTransition(name: string, engineId: string): unknown {
  return table.get(name)?.get(engineId);
}

export function hasTransition(name: string, engineId: string): boolean {
  return table.get(name)?.has(engineId) ?? false;
}

/** The names an engine can draw; every registered name when no engine is named. Sorted, the required four first. */
export function listTransitions(engineId?: string): string[] {
  const names = [...table.entries()].filter(([, byEngine]) => !engineId || byEngine.has(engineId)).map(([name]) => name);
  const required = new Set<string>(REQUIRED_TRANSITIONS);
  return names.sort((a, b) => Number(required.has(b)) - Number(required.has(a)) || a.localeCompare(b));
}

/** Every transition a film asks for: the default and each override, once. */
export function transitionNamesOf(ir: Pick<VideoIR, 'transitions'>): string[] {
  return [...new Set([ir.transitions.default.name, ...(ir.transitions.at ?? []).map((t) => t.name)])];
}

/** The names in the list the engine cannot draw — basis for ENGINE_TRANSITION_UNSUPPORTED. */
export function missingTransitions(names: string[], engineId: string): string[] {
  return [...new Set(names)].filter((n) => !hasTransition(n, engineId));
}

/**
 * Why an output node cannot go ahead: it has a film to show and the engine cannot draw a scene
 * format or a transition in it. One question for both output nodes (they may not share code with
 * each other, being capsules), asked of the film itself: the formats are read off the clips and the
 * transition names off the film, never off a constant.
 */
export function unsupportedFilmBlock(engine: EngineRef | undefined, ir: VideoIR | undefined): BlockReason | null {
  if (!ir || !engine) return null;
  const formats = ir.tracks.flatMap((t) => t.clips.flatMap((c) => (c.kind === 'code' ? [c.format] : [])));
  const noRenderer = missingCodeRenderers(formats, engine.engineId);
  if (noRenderer.length) return { kind: 'capability', code: ErrorCode.ENGINE_SCENE_UNSUPPORTED, message: `${engine.displayName} has no renderer for: ${noRenderer.join(', ')}` };
  const noTransition = missingTransitions(transitionNamesOf(ir), engine.engineId);
  if (noTransition.length) {
    return { kind: 'capability', code: ErrorCode.ENGINE_TRANSITION_UNSUPPORTED, message: `${engine.displayName} has no transition named: ${noTransition.join(', ')}`, fix: `pick one of: ${listTransitions(engine.engineId).join(', ') || 'none registered'}` };
  }
  return null;
}

/** Test-only. */
export function _resetTransitions(): void {
  table.clear();
}
