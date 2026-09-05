import type { PackDefinition } from '@/core/packs/definition';
import { githubShowcase } from './github-showcase/pack';
import { quoteCards } from './quote-cards/pack';

/**
 * Every pack this build ships. This is the only list the app reads: nothing outside `packs/` names
 * a pack, so installing another one is a line here plus a line in the two files beside it.
 */
export const INSTALLED_PACKS: PackDefinition[] = [githubShowcase, quoteCards];
