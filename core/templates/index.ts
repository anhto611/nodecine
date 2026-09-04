import { registerTemplate } from './registry';
import { staticScriptTemplate } from './static-script';

export const STATIC_SCRIPT_TEMPLATE = 'static-script';

export function registerCoreTemplates(): void {
  registerTemplate(STATIC_SCRIPT_TEMPLATE, staticScriptTemplate);
}
