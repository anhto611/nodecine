'use client';
import { registerCoreScenes } from '@/core/scenes/title-card';
import { registerCoreNodes } from '@/core/nodes';
import { registerCoreTemplates } from '@/core/templates';
import { registerRemotionClient } from '@/engines/remotion/register.client';
import { registerHyperframesClient } from '@/engines/hyperframes/register.client';
import { installPack } from '@/core/packs/definition';
import { INSTALLED_PACKS } from '@/packs/installed';
import { installClientPacks } from '@/packs/installed.client';
import { addPackLocales } from '@/lib/i18n';

let done = false;
/** Browser-side registrations: core scenes, core nodes, the Remotion player, the Hyperframes skeleton. */
export function bootstrapClient(): void {
  if (done) return;
  done = true;
  registerCoreScenes();
  registerCoreNodes();
  registerCoreTemplates();
  registerRemotionClient();
  registerHyperframesClient();
  for (const pack of INSTALLED_PACKS) {
    installPack(pack);
    if (pack.locales) addPackLocales(pack.locales);
  }
  installClientPacks();
}
