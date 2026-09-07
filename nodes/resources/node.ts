import { z } from 'zod';
import type { NodeDefinition } from '@/core/nodes/definition';
import { ErrorCode } from '@/core/errors';

/**
 * Resource nodes (CORE_CONTRACTS §5.7, EXECUTION_ENGINE §1.1): no inputs, run() = probe(),
 * always re-run, never `error` merely for being unavailable.
 */

/**
 * One node per port type, not per provider: the provider is a parameter, the way ComfyUI's Load
 * Checkpoint holds every checkpoint. Adding a provider is a line in `providers/installed.ts`.
 * `settings` is free-form here because the core must not import the provider list; the provider
 * validates its own settings when it is built.
 */
const ProviderParams = z.object({
  providerId: z.string(),
  settings: z.record(z.string(), z.unknown()).default({}),
});

const missingProvider = (kind: string) => [{ code: ErrorCode.INPUT_EMPTY, message: `Choose a ${kind} provider` }];

export const llmProvider: NodeDefinition<typeof ProviderParams> = {
  type: 'core/llm-provider',
  version: 1,
  kind: 'resource',
  inputs: [],
  outputs: [{ name: 'llm', type: 'LLMRef' }],
  paramsSchema: ProviderParams,
  defaultParams: { providerId: '', settings: {} },
  validate: (p) => (p.providerId ? [] : missingProvider('language model')),
  run: async ({ params, services }) => ({ llm: await services.probeLLM(params.providerId, params.settings) }),
};

export const ttsProvider: NodeDefinition<typeof ProviderParams> = {
  type: 'core/tts-provider',
  version: 1,
  kind: 'resource',
  inputs: [],
  outputs: [{ name: 'tts', type: 'TTSRef' }],
  paramsSchema: ProviderParams,
  defaultParams: { providerId: '', settings: {} },
  validate: (p) => (p.providerId ? [] : missingProvider('voice')),
  run: async ({ params, services }) => ({ tts: await services.probeTTS(params.providerId, params.settings) }),
};

const RemotionParams = z.object({
  concurrency: z.number().int().positive().optional(),
  glBackend: z.enum(['angle', 'swiftshader']).default('angle'),
});
export const remotionEngine: NodeDefinition<typeof RemotionParams> = {
  type: 'core/remotion-engine',
  version: 1,
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
  kind: 'resource',
  inputs: [],
  outputs: [{ name: 'engine', type: 'EngineRef' }],
  paramsSchema: HyperframesParams,
  defaultParams: {},
  run: async ({ params, services }) => ({ engine: await services.probeEngine('hyperframes', params) }),
};
