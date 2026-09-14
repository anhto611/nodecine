import { z } from 'zod';
import { NodeError } from '@/contracts/errors';
import { COMPOSITION_ENTRY, type Composition } from '@/contracts/types/composition';
import type { NodeDefinition } from '@/core/nodes/definition';
import { CompositionErrorCode } from './errors';
import type { Inspection } from './server';
import { STARTER_INDEX } from './starter';

const Params = z.object({
  /** The project's text files by path; `index.html` is the entry. */
  files: z.record(z.string(), z.string()).default({ [COMPOSITION_ENTRY]: STARTER_INDEX }),
  /** The project's binary files by path: uploaded assets this machine holds. */
  media: z.record(z.string(), z.string()).default({}),
});

/**
 * A HyperFrames composition kept in the workflow: written once, looked at, and filled by every run.
 * It is the engine's own project, not something NodeCine translates: HyperFrames lints it, reads its
 * variables and its size, and the output carries it as it is.
 */
export const composition: NodeDefinition<typeof Params> = {
  type: 'composition', version: 1, kind: 'source',
  inputs: [], outputs: [{ name: 'composition', type: 'Composition' }],
  paramsSchema: Params, defaultParams: { files: { [COMPOSITION_ENTRY]: STARTER_INDEX }, media: {} },
  validate: (params) => (params.files[COMPOSITION_ENTRY]?.trim() ? [] : [{ code: CompositionErrorCode.COMPOSITION_INVALID, message: `the project has no ${COMPOSITION_ENTRY}` }]),
  run: async ({ params, services, log }) => {
    if (!params.files[COMPOSITION_ENTRY]?.trim()) {
      throw new NodeError(CompositionErrorCode.COMPOSITION_INVALID, `the project has no ${COMPOSITION_ENTRY}`).withFix(`add an ${COMPOSITION_ENTRY} to the composition`);
    }
    const inspection = await services.invoke<Inspection>('composition/inspect', [params.files]);
    const errors = inspection.findings.filter((f) => f.severity === 'error');
    for (const f of inspection.findings.filter((x) => x.severity === 'warning')) log('warn', `${f.code}: ${f.message}`, f.code);
    if (errors.length) {
      const first = errors[0]!;
      throw new NodeError(CompositionErrorCode.COMPOSITION_INVALID, `${first.message}${errors.length > 1 ? ` (and ${errors.length - 1} more)` : ''}`, false, errors).withFix(first.fixHint ?? 'fix the composition and run again');
    }
    const out: Composition = {
      engine: 'hyperframes',
      width: inspection.width ?? 1080,
      height: inspection.height ?? 1920,
      fps: 30,
      files: params.files,
      media: params.media as Composition['media'],
      variables: inspection.variables,
      values: {},
    };
    log('info', `${out.width}×${out.height} · ${Object.keys(out.files).length} files · ${out.variables.length} variables`);
    return { composition: out };
  },
};
