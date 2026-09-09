import { registerNodes } from '@/nodes';
import { installProviders } from '@/providers/installed.server';
import { registerRemotionServer } from '@/engines/remotion/register.server';
import { registerHyperframesServer } from '@/engines/hyperframes/register.server';

/**
 * Server-side registration of every node, engine and provider (ARCHITECTURE §2). Import this module
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
  installProviders();
  registerRemotionServer();
  registerHyperframesServer();
}
