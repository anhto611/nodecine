import { z } from 'zod';
import { ErrorCode } from '@/core/errors';
import type { NodeDefinition } from '@/core/nodes/definition';

const Params = z.object({
  value: z.string(),
  /**
   * Every line is its own run of the whole workflow (EXECUTION_ENGINE §9). Read by the runner, not
   * by this node — the same place ComfyUI reads `control_after_generate` from: a widget the queue
   * interprets, while the node itself keeps emitting one value.
   */
  perRun: z.boolean().default(false),
});

/** CORE_CONTRACTS §5.1 — a text box; no interpretation, no network. */
export const inputTrigger: NodeDefinition<typeof Params> = {
  type: 'core/input-trigger',
  version: 1,
  kind: 'source',
  inputs: [],
  outputs: [{ name: 'source', type: 'SourceRef' }],
  paramsSchema: Params,
  defaultParams: { value: '', perRun: false },
  validate: (p) => (p.value.trim() ? [] : [{ code: ErrorCode.INPUT_EMPTY, message: 'Please enter content before running' }]),
  run: async ({ params }) => ({ source: { value: params.value.trim() } }),
};
