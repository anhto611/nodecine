'use client';
import { registerCoreNodes } from '@/core/nodes';
import { registerRemotionClient } from '@/engines/remotion/register.client';
import { registerHyperframesClient } from '@/engines/hyperframes/register.client';
import { registerTemplates } from '@/templates';
import { registerTemplate } from '@/core/templates/registry';
import { loadUserTemplates } from '@/lib/storage';

let done = false;
/** Browser-side registrations: core nodes, the two engines, the templates. */
export function bootstrapClient(): void {
  if (done) return;
  done = true;
  registerCoreNodes();
  registerRemotionClient();
  registerHyperframesClient();
  registerTemplates();
  for (const t of loadUserTemplates()) {
    try { registerTemplate(t); } catch { /* a template someone hand-edited badly should not stop the app */ }
  }
}
