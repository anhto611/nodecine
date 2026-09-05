import { registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import { registerGithubShowcaseScenes } from './github/scenes/schemas';
import { githubFetcher } from './github/nodes/github-fetcher';
import { registerQuoteCardsScenes } from './quotes/scenes/schemas';
import { en as githubEn, vi as githubVi } from './github/locales';

/**
 * The nodes and scene types the app ships beyond the framework itself — the way ComfyUI keeps its
 * own extra nodes in `comfy_extras/` and loads them from a list in core. They are always installed:
 * a fresh install has every one of them in the Library, and nothing here can be switched off. They
 * are ordinary registrations into the flat registries: no wrapper object, no owner, no lifecycle.
 * A template under `templates/` names them by string, and naming is the whole relationship.
 *
 * Isomorphic on purpose: no React, no canvas, no Node built-ins, because the server calls this too.
 * Renderers, Studio bodies and server operations are wired from the three lists beside this one.
 */
export function installExtras(): void {
  registerGithubShowcaseScenes();
  registerNodeType(githubFetcher as unknown as AnyNodeDefinition);
  registerQuoteCardsScenes();
}

/** Display strings these nodes contribute, merged into the dictionaries at startup. */
export const EXTRA_LOCALES: Record<string, Record<string, string>> = {
  en: { ...githubEn },
  vi: { ...githubVi },
};
