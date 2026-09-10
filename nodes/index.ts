import { registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import { inputTrigger } from './input/node';
import { githubFetcher } from './github/node';
import { webFetcher } from './web/node';
import { staticScript } from './script/node';
import { screenwriter } from './screenwriter/node';
import { stockMedia } from './stock/node';
import { sceneBreakdown } from './breakdown/node';
import { illustrator } from './illustrator/node';
import { hyperframesEngine, llmProvider, remotionEngine, ttsProvider } from './resources/node';
import { ttsEngine } from './tts/node';
import { transcribe } from './transcribe/node';
import { audioInput, audioMix } from './audio/node';
import { captions, captionExport } from './captions/node';
import { timelineAssembler } from './assembler/node';
import { mp4Export, videoOutput } from './output/node';

/**
 * Every node the app ships, one family per directory (ARCHITECTURE §2): the definition, its logic,
 * its body and its tests live together, the way `comfy_extras/nodes_*.py` groups ComfyUI's nodes.
 * All of them are always installed; this list is the only place a family is named. `core/` holds
 * the framework and never imports from here.
 */
export const ALL_NODES: AnyNodeDefinition[] = [
  inputTrigger,
  githubFetcher,
  webFetcher,
  staticScript,
  illustrator,
  screenwriter,
  stockMedia,
  sceneBreakdown,
  llmProvider,
  ttsProvider,
  ttsEngine,
  transcribe,
  audioInput,
  audioMix,
  captions,
  captionExport,
  timelineAssembler,
  remotionEngine,
  hyperframesEngine,
  videoOutput,
  mp4Export,
] as unknown as AnyNodeDefinition[];

export function registerNodes(): void {
  for (const def of ALL_NODES) registerNodeType(def);
}

export { audioInput, audioMix, AUDIO_INPUT, AUDIO_MIX } from './audio/node';
export { captionExport } from './captions/node';
export { stockMedia, STOCK_MEDIA } from './stock/node';
export { sceneBreakdown, SCENE_BREAKDOWN } from './breakdown/node';
export { inputTrigger, githubFetcher, webFetcher, staticScript, illustrator, screenwriter, llmProvider, ttsProvider, ttsEngine, transcribe, captions, timelineAssembler, remotionEngine, hyperframesEngine, videoOutput, mp4Export };
export { pickVoice } from './tts/node';
export { DEFAULT_STATIC_SCRIPT } from './script/node';
export { SCREENWRITER, DEFAULT_SCREENWRITER } from './screenwriter/node';
export { ILLUSTRATOR, DEFAULT_ILLUSTRATOR } from './illustrator/node';
export { GITHUB_FETCHER } from './github/node';
