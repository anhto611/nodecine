'use client';
import { registerCoreNodes } from '@/core/nodes';
import { registerRemotionClient } from '@/engines/remotion/register.client';
import { registerHyperframesClient } from '@/engines/hyperframes/register.client';
import { registerTemplates } from '@/templates';

let done = false;
/** Browser-side registrations: core nodes, the two engines, the shipped templates. The user's own workflows are files on the server and arrive through the store. */
export function bootstrapClient(): void {
  if (done) return;
  done = true;
  registerCoreNodes();
  registerRemotionClient();
  registerHyperframesClient();
  registerTemplates();
}
