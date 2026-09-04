'use client';
import { registerCoreScenes } from '@/core/scenes/title-card';
import { registerCoreNodes } from '@/core/nodes';
import { registerRemotionClient } from '@/engines/remotion/register.client';
import { registerHyperframes } from '@/engines/hyperframes/adapter';

let done = false;
/** Browser-side registrations: core scenes, core nodes, the Remotion player, the Hyperframes skeleton. */
export function bootstrapClient(): void {
  if (done) return;
  done = true;
  registerCoreScenes();
  registerCoreNodes();
  registerRemotionClient();
  registerHyperframes();
}
