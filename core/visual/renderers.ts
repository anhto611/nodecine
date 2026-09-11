/**
 * Which engines can draw which scene-code format (CORE_CONTRACTS §2.8, §4). Every clip of an IR names
 * its format, `html-gsap` today; an engine registers one renderer per format it understands, and the
 * output nodes stop by capability when the chosen engine lacks one (`unsupportedFilmBlock` in
 * `transitions.ts` asks both questions). The core imports no engine: renderers are `unknown` here,
 * a React component for Remotion, a mount function for Hyperframes.
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

/** The formats an engine can draw, for a node that picks a format by the engine wired in. */
export function listCodeFormats(engineId: string): string[] {
  return [...table.entries()].filter(([, byEngine]) => byEngine.has(engineId)).map(([format]) => format).sort();
}

/** Formats in the list the engine cannot draw — basis for ENGINE_SCENE_UNSUPPORTED. */
export function missingCodeRenderers(formats: string[], engineId: string): string[] {
  return [...new Set(formats)].filter((f) => !hasCodeRenderer(f, engineId));
}

/** Test-only. */
export function _resetCodeRenderers(): void {
  table.clear();
}
