import { z } from 'zod';
import type { NodeDefinition } from '@/core/nodes/definition';
const Params = z.object({});
export const hyperframesEngine: NodeDefinition<typeof Params> = { type: 'core/hyperframes-engine', version: 1, kind: 'resource', inputs: [], outputs: [{ name: 'engine', type: 'EngineRef' }], paramsSchema: Params, defaultParams: {}, run: async ({ params, services }) => ({ engine: await services.probeEngine('hyperframes', params) }) };
