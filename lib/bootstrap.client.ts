'use client';
import { registerNodes } from '@/capsules/nodes';
import { ENGINE_CLIENT_REGISTRATIONS } from '@/capsules/engines/.generated/client';

/**
 * Browser-side registrations: every node, and each engine's player and preview. No template ships
 * yet; the first comes with the first genre. The user's own workflows are files on the server and
 * arrive through the store.
 *
 * No "already done" flag, for the reason spelled out in `server/register.ts`: every registration is
 * a `Map.set`, and a flag that outlives the registry it guards leaves the app with no node types.
 */
export function bootstrapClient(): void {
  registerNodes();
  for (const register of ENGINE_CLIENT_REGISTRATIONS) register();
}
