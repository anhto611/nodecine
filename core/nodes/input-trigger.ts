import { z } from 'zod';
import { ErrorCode } from '../errors';
import type { NodeDefinition } from './definition';

const Params = z.object({ value: z.string() });

/** CORE_CONTRACTS §5.1 — a text box; no interpretation, no network. */
export const inputTrigger: NodeDefinition<typeof Params> = {
  type: 'core/input-trigger',
  version: 1,
  pack: 'core',
  kind: 'source',
  inputs: [],
  outputs: [{ name: 'source', type: 'SourceRef' }],
  paramsSchema: Params,
  defaultParams: { value: '' },
  validate: (p) => (p.value.trim() ? [] : [{ code: ErrorCode.INPUT_EMPTY, message: 'Please enter content before running' }]),
  run: async ({ params }) => ({ source: { value: params.value.trim() } }),
};
