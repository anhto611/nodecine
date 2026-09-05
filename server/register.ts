/**
 * Server-side registration of every concrete engine and provider (ARCHITECTURE §2).
 * Import this module once from each API route; core registries start empty.
 */
import { registerCoreScenes } from '@/core/scenes/title-card';
import { registerCoreNodes } from '@/core/nodes';
import { installProviders } from '@/providers/installed.server';
import { registerRemotionServer } from '@/engines/remotion/register.server';
import { registerHyperframesServer } from '@/engines/hyperframes/register.server';
import { installExtras } from '@/extras/installed';
import { installServerExtras } from '@/extras/installed.server';

let done = false;
export function ensureServerRegistrations(): void {
  if (done) return;
  done = true;
  registerCoreScenes();
  registerCoreNodes();
  installProviders();
  registerRemotionServer();
  registerHyperframesServer();
  installExtras();
  installServerExtras();
}
