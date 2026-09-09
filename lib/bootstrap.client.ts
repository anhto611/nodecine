'use client';
import { registerNodes } from '@/nodes';
import { registerRemotionClient } from '@/engines/remotion/register.client';
import { registerHyperframesClient } from '@/engines/hyperframes/register.client';
import { registerTemplates } from '@/templates';

/**
 * Browser-side registrations: core nodes, the two engines, the shipped templates. The user's own
 * workflows are files on the server and arrive through the store.
 *
 * No "already done" flag, for the reason spelled out in `server/register.ts`: every registration is
 * a `Map.set`, and a flag that outlives the registry it guards leaves the app with no node types.
 */
export function bootstrapClient(): void {
  registerNodes();
  registerRemotionClient();
  registerHyperframesClient();
  registerTemplates();
}
