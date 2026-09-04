import type { EngineAdapterFactory } from './types';

/** Empty registry; engines/* self-register at startup (ARCHITECTURE §2). */
const factories = new Map<string, EngineAdapterFactory>();

export function registerEngine(engineId: string, factory: EngineAdapterFactory): void {
  factories.set(engineId, factory);
}

export function getEngineFactory(engineId: string): EngineAdapterFactory | undefined {
  return factories.get(engineId);
}

export function listEngineIds(): string[] {
  return [...factories.keys()];
}

/** Test-only. */
export function _resetEngineRegistry(): void {
  factories.clear();
}
