/**
 * Server-side registration of every concrete engine and provider (ARCHITECTURE §2).
 * Import this module once from each API route; core registries start empty.
 */
import { registerNodes } from '@/nodes';
import { installProviders } from '@/providers/installed.server';
import { registerRemotionServer } from '@/engines/remotion/register.server';
import { registerHyperframesServer } from '@/engines/hyperframes/register.server';

let done = false;
export function ensureServerRegistrations(): void {
  if (done) return;
  done = true;
  registerNodes();
  installProviders();
  registerRemotionServer();
  registerHyperframesServer();
}
