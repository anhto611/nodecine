import type { ZodTypeAny } from 'zod';

/**
 * Port types (CORE_CONTRACTS §1.1): what may run on a wire. The core runs wires and knows none by
 * name; `contracts/ports.ts` names them and registers them at startup, like every other registry here.
 *
 * `PortTypes` is filled the same way, by module augmentation, so a node that declares a port with a
 * misspelt type still fails to compile even though the core never lists a single one.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PortTypes {}

export type PortType = Extract<keyof PortTypes, string>;

export interface PortTypeInfo {
  /** Display label next to each port — a dictionary key, translated by the UI locale. */
  labelKey: string;
  /** What every packet on this wire must parse as. A type without one is carried unchecked. */
  schema?: ZodTypeAny;
}

const registry = new Map<string, PortTypeInfo>();

export function registerPortType(type: PortType, info: PortTypeInfo): void {
  registry.set(type, info);
}

export function getPortType(type: string): PortTypeInfo | undefined {
  return registry.get(type);
}

export function isPortType(value: string): value is PortType {
  return registry.has(value);
}

/** The label key for a port, or the type's own name when nothing registered it. */
export function portLabelKey(type: string): string {
  return registry.get(type)?.labelKey ?? type;
}

export function listPortTypes(): PortType[] {
  return [...registry.keys()] as PortType[];
}

/** Test-only. */
export function _resetPortTypes(): void {
  registry.clear();
}
