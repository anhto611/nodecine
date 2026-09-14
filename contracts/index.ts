import { registerPortTypes } from './ports';

/**
 * The video contracts between nodes (ARCHITECTURE §2): what runs on a wire, the IR, how a scene is
 * drawn, a model, a voice and an engine. The core runs graphs of nodes and knows none of it; nodes
 * import from here, and this registers into the core's empty tables at startup.
 */
export function registerContracts(): void {
  registerPortTypes();
}
