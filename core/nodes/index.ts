import { registerNodeType, type AnyNodeDefinition } from './definition';
import { inputTrigger } from './input-trigger';
import { githubFetcher } from './github-fetcher';
import { staticScript } from './static-script';
import { aiDirector } from './ai-director';
import { stage } from './stage';
import { block } from './block';
import { hyperframesEngine, llmProvider, remotionEngine, ttsProvider } from './resources';
import { ttsEngine } from './tts-engine';
import { timelineAssembler } from './timeline-assembler';
import { mp4Export, videoOutput } from './outputs';

export const CORE_NODES: AnyNodeDefinition[] = [
  inputTrigger,
  githubFetcher,
  llmProvider,
  ttsProvider,
  staticScript,
  stage,
  block,
  aiDirector,
  ttsEngine,
  timelineAssembler,
  remotionEngine,
  hyperframesEngine,
  videoOutput,
  mp4Export,
] as unknown as AnyNodeDefinition[];

export function registerCoreNodes(): void {
  for (const def of CORE_NODES) registerNodeType(def);
}

export * from './definition';
export { inputTrigger, githubFetcher, staticScript, stage, block, aiDirector, llmProvider, ttsProvider, ttsEngine, timelineAssembler, remotionEngine, hyperframesEngine, videoOutput, mp4Export };
export { pickVoice } from './tts-engine';
export { DEFAULT_STATIC_SCRIPT } from './static-script';
export { AI_DIRECTOR, DEFAULT_AI_DIRECTOR } from './ai-director';
export { STAGE, DEFAULT_STAGE } from './stage';
export { BLOCK, DEFAULT_BLOCK } from './block';
export { GITHUB_FETCHER, FETCH_REPO_OP } from './github-fetcher';
