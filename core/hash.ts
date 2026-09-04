/**
 * Stable content hashing for edge packets and node signatures
 * (CORE_CONTRACTS §1.2, EXECUTION_ENGINE §3).
 *
 * Not for security — only for content comparison and cache keys.
 * Runs in both browser and Node, synchronously, with no dependencies.
 */

/** JSON with object keys sorted, so equal content always yields the same string. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = sortKeys(v);
    }
    return out;
  }
  return value;
}

/** FNV-1a 64-bit over UTF-16 code units, returned as 16 hex characters. */
export function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

export function contentHash(value: unknown): string {
  return fnv1a64(stableStringify(value));
}
