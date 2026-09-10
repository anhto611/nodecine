import { z } from 'zod';
import type { NodeDefinition } from '@/core/nodes/definition';
const Params = z.object({ concurrency: z.number().int().positive().optional(), glBackend: z.enum(['angle', 'swiftshader']).default('angle') });
export const remotionEngine: NodeDefinition<typeof Params> = { type: 'core/remotion-engine', version: 1, kind: 'resource', inputs: [], outputs: [{ name: 'engine', type: 'EngineRef' }], paramsSchema: Params, defaultParams: { glBackend: 'angle' }, run: async ({ params, services }) => ({ engine: await services.probeEngine('remotion', params) }) };
