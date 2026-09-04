import { z } from 'zod';
import type { NodeDefinition } from './definition';

/**
 * Resource nodes (CORE_CONTRACTS §5.7, EXECUTION_ENGINE §1.1): no inputs, run() = probe(),
 * always re-run, never `error` merely for being unavailable.
 */

const LLMParams = z.object({ model: z.string().optional() });
export const claudeCodeProvider: NodeDefinition<typeof LLMParams> = {
  type: 'core/claude-code-provider',
  version: 1,
  pack: 'core',
  kind: 'resource',
  inputs: [],
  outputs: [{ name: 'llm', type: 'LLMRef' }],
  paramsSchema: LLMParams,
  defaultParams: {},
  run: async ({ params, services }) => ({ llm: await services.probeLLM('claude-code', params) }),
};

const TTSParams = z.object({ defaultVoice: z.string().optional(), rate: z.number().positive().default(1) });
export const systemTtsProvider: NodeDefinition<typeof TTSParams> = {
  type: 'core/system-tts-provider',
  version: 1,
  pack: 'core',
  kind: 'resource',
  inputs: [],
  outputs: [{ name: 'tts', type: 'TTSRef' }],
  paramsSchema: TTSParams,
  defaultParams: { rate: 1 },
  run: async ({ params, services }) => ({ tts: await services.probeTTS('system-tts', params) }),
};

const RemotionParams = z.object({
  concurrency: z.number().int().positive().optional(),
  glBackend: z.enum(['angle', 'swiftshader']).default('angle'),
});
export const remotionEngine: NodeDefinition<typeof RemotionParams> = {
  type: 'core/remotion-engine',
  version: 1,
  pack: 'core',
  kind: 'resource',
  inputs: [],
  outputs: [{ name: 'engine', type: 'EngineRef' }],
  paramsSchema: RemotionParams,
  defaultParams: { glBackend: 'angle' },
  run: async ({ params, services }) => ({ engine: await services.probeEngine('remotion', params) }),
};

const HyperframesParams = z.object({});
export const hyperframesEngine: NodeDefinition<typeof HyperframesParams> = {
  type: 'core/hyperframes-engine',
  version: 1,
  pack: 'core',
  kind: 'resource',
  inputs: [],
  outputs: [{ name: 'engine', type: 'EngineRef' }],
  paramsSchema: HyperframesParams,
  defaultParams: {},
  run: async ({ params, services }) => ({ engine: await services.probeEngine('hyperframes', params) }),
};
