import type { EngineAdapter, EngineAdapterFactory } from './types';

/** Empty registry; the engine capsules self-register at startup (ARCHITECTURE §2). */
const factories = new Map<string, EngineAdapterFactory>();

export function registerEngine(engineId: string, factory: EngineAdapterFactory): void {
  factories.set(engineId, factory);
}

export function getEngineFactory(engineId: string): EngineAdapterFactory | undefined {
  return factories.get(engineId);
}

/** The engine the Studio draws a lone scene with: the first registered one that can. */
export function previewEngine(): EngineAdapter | undefined {
  for (const f of factories.values()) {
    const adapter = f({});
    if (adapter.previewScene) return adapter;
  }
  return undefined;
}

export function listEngineIds(): string[] {
  return [...factories.keys()];
}

/** Test-only. */
export function _resetEngineRegistry(): void {
  factories.clear();
}
