import { registerTemplate } from './registry';
import { staticScriptTemplate } from './static-script';

export const STATIC_SCRIPT_TEMPLATE = 'static-script';

export function registerCoreTemplates(): void {
  registerTemplate({
    id: STATIC_SCRIPT_TEMPLATE,
    nameKey: 'templates.staticScript',
    descriptionKey: 'templates.staticScriptDesc',
    category: 'core',
    nodeCount: 7,
    build: staticScriptTemplate,
  });
}
