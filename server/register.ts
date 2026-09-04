/**
 * Server-side registration of every concrete engine and provider (ARCHITECTURE §2).
 * Import this module once from each API route; core registries start empty.
 */
import { registerCoreScenes } from '@/core/scenes/title-card';
import { registerCoreNodes } from '@/core/nodes';
import { registerSystemTts } from '@/providers/system-tts';
import { registerClaudeCode } from '@/providers/claude-code';
import { registerRemotionServer } from '@/engines/remotion/register.server';
import { registerHyperframes } from '@/engines/hyperframes/adapter';

let done = false;
export function ensureServerRegistrations(): void {
  if (done) return;
  done = true;
  registerCoreScenes();
  registerCoreNodes();
  registerSystemTts();
  registerClaudeCode();
  registerRemotionServer();
  registerHyperframes();
}
