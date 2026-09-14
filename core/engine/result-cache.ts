import type { PortType } from '../types/ports';

/**
 * Results by what produced them.
 *
 * The signature cache used to be the runtime map: one result per node, the last one. Run a workflow
 * with one setting, then another, then the first again, and the third run paid for everything the
 * first had already paid for — and a restart forgot it all. A result is a function of its signature,
 * so it is kept by signature: any number of them, and on disk when the host gives the executor a
 * store that writes there.
 *
 * Only nodes with outputs are kept. A sink shows or writes something every time it runs, and an
 * on-demand node is run because somebody asked for it again.
 */

export interface CachedPacket {
  payloadType: PortType;
  payload: unknown;
  contentHash: string;
}

export interface CachedResult {
  outputs: Record<string, CachedPacket>;
  warnings?: { code?: string; message: string }[];
  durationMs?: number;
}

export interface ResultCache {
  /** The result stored under this signature, or nothing. A store that cannot read answers nothing. */
  get(signature: string): Promise<CachedResult | undefined>;
  set(signature: string, result: CachedResult): Promise<void>;
}

/** Kept in the process, newest last; the oldest go once there are more than `capacity`. */
export class MemoryResultCache implements ResultCache {
  private readonly entries = new Map<string, CachedResult>();

  constructor(private readonly capacity = 500) {}

  async get(signature: string): Promise<CachedResult | undefined> {
    const hit = this.entries.get(signature);
    if (!hit) return undefined;
    // Reading counts as use: a result asked for again is the one worth keeping.
    this.entries.delete(signature);
    this.entries.set(signature, hit);
    return hit;
  }

  async set(signature: string, result: CachedResult): Promise<void> {
    this.entries.delete(signature);
    this.entries.set(signature, result);
    while (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value!);
  }
}
