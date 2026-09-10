import { z } from 'zod';
import { ErrorCode } from '@/core/errors';
import type { NodeDefinition } from '@/core/nodes/definition';
const Params = z.object({ providerId: z.string(), settings: z.record(z.string(), z.unknown()).default({}) });
export const llmProvider: NodeDefinition<typeof Params> = { type: 'core/llm-provider', version: 1, kind: 'resource', inputs: [], outputs: [{ name: 'llm', type: 'LLMRef' }], paramsSchema: Params, defaultParams: { providerId: '', settings: {} }, validate: (p) => p.providerId ? [] : [{ code: ErrorCode.INPUT_EMPTY, message: 'Choose a language model provider' }], run: async ({ params, services }) => ({ llm: await services.probeLLM(params.providerId, params.settings) }) };
