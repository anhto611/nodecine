import type { EngineAdapter, EngineAdapterFactory } from './types';

/** Empty registry; the engine capsules self-register at startup (ARCHITECTURE §2). */
const factories = new Map<string, EngineAdapterFactory>();
let stillDrawer: string | null = null;

export interface EngineRegistration {
  /**
   * This engine draws the lone scenes the Studio shows outside a film — the storyboard, a modal.
   * Said at registration rather than found by building every adapter and looking for `previewScene`:
   * which engine gets the job stopped depending on the order the capsules happened to load.
   */
  drawsStills?: boolean;
}

export function registerEngine(engineId: string, factory: EngineAdapterFactory, options: EngineRegistration = {}): void {
  factories.set(engineId, factory);
  if (options.drawsStills) stillDrawer = engineId;
}

export function getEngineFactory(engineId: string): EngineAdapterFactory | undefined {
  return factories.get(engineId);
}

/** The engine the Studio draws a lone scene with, or none when no engine claimed the job. */
export function previewEngine(): EngineAdapter | undefined {
  const factory = stillDrawer === null ? undefined : factories.get(stillDrawer);
  const adapter = factory?.({});
  return adapter?.previewScene ? adapter : undefined;
}

export function listEngineIds(): string[] {
  return [...factories.keys()];
}

/** Test-only. */
export function _resetEngineRegistry(): void {
  factories.clear();
  stillDrawer = null;
}
