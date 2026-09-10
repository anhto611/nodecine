import { z } from 'zod';
import { ErrorCode } from '@/core/errors';
import type { NodeDefinition } from '@/core/nodes/definition';
const Params = z.object({ providerId: z.string(), settings: z.record(z.string(), z.unknown()).default({}) });
export const ttsProvider: NodeDefinition<typeof Params> = { type: 'core/tts-provider', version: 1, kind: 'resource', inputs: [], outputs: [{ name: 'tts', type: 'TTSRef' }], paramsSchema: Params, defaultParams: { providerId: '', settings: {} }, validate: (p) => p.providerId ? [] : [{ code: ErrorCode.INPUT_EMPTY, message: 'Choose a voice provider' }], run: async ({ params, services }) => ({ tts: await services.probeTTS(params.providerId, params.settings) }) };
