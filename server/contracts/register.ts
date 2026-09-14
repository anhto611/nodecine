import { registerNodes } from '@/capsules/nodes';
import { installProviders } from '@/capsules/providers/.generated/server';
import { ENGINE_SERVER_REGISTRATIONS } from '@/capsules/engines/.generated/server';

/**
 * Server-side registration of every capsule: the nodes, the providers, and each engine's renderer and
 * producer. Core registries start empty, so this has to run before
 * anything reads one.
 *
 * Called from the two places that read them rather than from each route: the job hub, before it
 * validates a graph or builds an executor, and `createServerServices`. A rule of the form "remember
 * to import this in every new route" is a rule that gets forgotten — and forgetting it looked like
 * every node of a good workflow being reported as `NODE_TYPE_UNKNOWN`. Routes that need something
 * registered without going through the hub (the vendor and asset routes) still call it.
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
  for (const register of ENGINE_SERVER_REGISTRATIONS) register();
}
