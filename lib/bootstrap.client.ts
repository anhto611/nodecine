'use client';
import { registerNodes } from '@/nodes';
import { NODE_CLIENT_REGISTRATIONS } from '@/nodes/index.client';
import { registerTemplates } from '@/templates';

/**
 * Browser-side registrations: every node, whatever a capsule registers of its own (an engine's player
 * and preview), the shipped templates. The user's own
 * workflows are files on the server and arrive through the store.
 *
 * No "already done" flag, for the reason spelled out in `server/register.ts`: every registration is
 * a `Map.set`, and a flag that outlives the registry it guards leaves the app with no node types.
 */
export function bootstrapClient(): void {
  registerNodes();
  for (const register of NODE_CLIENT_REGISTRATIONS) register();
  registerTemplates();
}
