import { registerNodeType, type AnyNodeDefinition } from './definition';
import { inputTrigger } from './input-trigger';
import { staticScript } from './static-script';
import { claudeCodeProvider, hyperframesEngine, remotionEngine, systemTtsProvider } from './resources';
import { ttsEngine } from './tts-engine';
import { timelineAssembler } from './timeline-assembler';
import { mp4Export, videoOutput } from './outputs';

export const CORE_NODES: AnyNodeDefinition[] = [
  inputTrigger,
  staticScript,
  claudeCodeProvider,
  systemTtsProvider,
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
export { inputTrigger, staticScript, claudeCodeProvider, systemTtsProvider, ttsEngine, timelineAssembler, remotionEngine, hyperframesEngine, videoOutput, mp4Export };
export { pickVoice } from './tts-engine';
export { DEFAULT_STATIC_SCRIPT } from './static-script';
