'use client';
import { registerCoreScenes } from '@/core/scenes/title-card';
import { registerCoreNodes } from '@/core/nodes';
import { registerRemotionClient } from '@/engines/remotion/register.client';
import { registerHyperframesClient } from '@/engines/hyperframes/register.client';
import { installExtras, EXTRA_LOCALES } from '@/extras/installed';
import { installClientExtras } from '@/extras/installed.client';
import { registerTemplates } from '@/templates';
import { registerTemplate } from '@/core/templates/registry';
import { loadUserTemplates } from '@/lib/storage';
import { addLocales } from '@/lib/i18n';

let done = false;
/** Browser-side registrations: core scenes, core nodes, the Remotion player, the Hyperframes skeleton. */
export function bootstrapClient(): void {
  if (done) return;
  done = true;
  registerCoreScenes();
  registerCoreNodes();
  registerRemotionClient();
  registerHyperframesClient();
  installExtras();
  addLocales(EXTRA_LOCALES);
  installClientExtras();
  registerTemplates();
  for (const t of loadUserTemplates()) {
    try { registerTemplate(t); } catch { /* a template someone hand-edited badly should not stop the app */ }
  }
}
