import { registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import { inputTrigger } from './input/node';
import { githubFetcher } from './github/node';
import { staticScript } from './script/node';
import { aiDirector } from './director/node';
import { stage } from './look/stage';
import { blocks } from './look/blocks';
import { hyperframesEngine, llmProvider, remotionEngine, ttsProvider } from './resources/node';
import { ttsEngine } from './tts/node';
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
  staticScript,
  stage,
  blocks,
  aiDirector,
  llmProvider,
  ttsProvider,
  ttsEngine,
  timelineAssembler,
  remotionEngine,
  hyperframesEngine,
  videoOutput,
  mp4Export,
] as unknown as AnyNodeDefinition[];

export function registerNodes(): void {
  for (const def of ALL_NODES) registerNodeType(def);
}

export { inputTrigger, githubFetcher, staticScript, stage, blocks, aiDirector, llmProvider, ttsProvider, ttsEngine, timelineAssembler, remotionEngine, hyperframesEngine, videoOutput, mp4Export };
export { pickVoice } from './tts/node';
export { DEFAULT_STATIC_SCRIPT } from './script/node';
export { AI_DIRECTOR, DEFAULT_AI_DIRECTOR } from './director/node';
export { STAGE, DEFAULT_STAGE } from './look/stage';
export { BLOCKS, DEFAULT_BLOCK, DEFAULT_BLOCKS } from './look/blocks';
export { GITHUB_FETCHER } from './github/node';
