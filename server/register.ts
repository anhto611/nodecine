import { NODE_LIBRARIES, registerNodes } from '@/nodes';
import { registerLibrary } from '@/server/paths';
import { installProviders } from '@/providers/installed.server';
import { NODE_SERVER_REGISTRATIONS } from '@/nodes/.generated/server';

/**
 * Server-side registration of every node, provider, and whatever a capsule registers of its own — an
 * engine, a renderer (ARCHITECTURE §2). Import this module
 * once from each API route; core registries start empty.
 *
 * Called on every request, with no "already done" flag. Every registration underneath is a `Map.set`
 * — cheap, and setting the same key twice is the same as setting it once. A flag looks like a saving
 * and is really a trap: in dev a hot reload can hand `core/nodes/definition.ts` a fresh module with
 * an empty registry while this module keeps the old instance with the flag still set, and then
 * nothing ever registers again. What that looks like from the outside is every node in a perfectly
 * good workflow reported as `NODE_TYPE_UNKNOWN`, minutes after the same workflow ran.
 */
export function ensureServerRegistrations(): void {
  registerNodes();
  for (const [name, spec] of Object.entries(NODE_LIBRARIES)) registerLibrary(name, spec);
  installProviders();
  for (const register of NODE_SERVER_REGISTRATIONS) register();
}
