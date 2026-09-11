/**
 * What a drawn scene may rely on and what an engine must honour (CORE_CONTRACTS §2.8): the hooks
 * in the markup and the helpers in the script. The Illustrator writes to this contract and every
 * engine implements it; the names live here so the prompt, the lint and the page builder can
 * never disagree about them.
 */

/** The class on the root element of every scene; the style sheet sets its ground, colours and type there. */
export const SCENE_ROOT_CLASS = 'nc-scene';
/** `data-slot="captions"`: where a scene wants its caption lines; without it the engine adds the default band. */
export const CAPTION_SLOT = 'captions';
export const DEFAULT_CAPTION_BAND_CLASS = 'nc-captions-default';
/** `data-var="<name>"` takes a value of the whole video; `data-fact="<key>"` a verified value of this scene. */
export const VAR_ATTR = 'data-var';
export const FACT_ATTR = 'data-fact';
/** A picture the model is told about as `asset:<path>`, swapped for the file after the answer. */
export const ASSET_TOKEN_PREFIX = 'asset:';
/** The accent-coloured phrase. */
export const EMPH_CLASS = 'nc-emph';
/** The variables every style sheet defines on the scene root, and every scene may use. */
export const STYLE_VARS = ['bg', 'fg', 'accent', 'muted', 'line', 'font-display', 'font-body'] as const;
/** What a scene's script finds on `nodecine`. */
export const SCENE_SCRIPT_API = ['timeline', 'root', 'index', 'duration', 'words', 'when', 'count', 'beats', 'beat', 'audio'] as const;
