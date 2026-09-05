/**
 * Server-side registration of every concrete engine and provider (ARCHITECTURE §2).
 * Import this module once from each API route; core registries start empty.
 */
import { registerCoreNodes } from '@/core/nodes';
import { installProviders } from '@/providers/installed.server';
import { registerRemotionServer } from '@/engines/remotion/register.server';
import { registerHyperframesServer } from '@/engines/hyperframes/register.server';
import { registerServerOp } from '@/core/server-ops';
import { FETCH_REPO_OP } from '@/core/nodes/github-fetcher';
import { fetchRepo } from '@/server/github/fetch-repo';

let done = false;
export function ensureServerRegistrations(): void {
  if (done) return;
  done = true;
  registerCoreNodes();
  installProviders();
  registerRemotionServer();
  registerHyperframesServer();
  registerServerOp(FETCH_REPO_OP, (input, signal) => fetchRepo(input, signal));
}
