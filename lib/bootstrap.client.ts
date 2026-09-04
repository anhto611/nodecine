'use client';
import { registerCoreScenes } from '@/core/scenes/title-card';
import { registerCoreNodes } from '@/core/nodes';
import { registerCoreTemplates } from '@/core/templates';
import { registerRemotionClient } from '@/engines/remotion/register.client';
import { registerHyperframes } from '@/engines/hyperframes/adapter';
import { registerGithubShowcase } from '@/packs/github-showcase';
import { registerGithubShowcaseUi } from '@/packs/github-showcase/ui/register.client';

let done = false;
/** Browser-side registrations: core scenes, core nodes, the Remotion player, the Hyperframes skeleton. */
export function bootstrapClient(): void {
  if (done) return;
  done = true;
  registerCoreScenes();
  registerCoreNodes();
  registerCoreTemplates();
  registerRemotionClient();
  registerHyperframes();
  registerGithubShowcase();
  registerGithubShowcaseUi();
}
