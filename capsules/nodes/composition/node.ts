import { z } from 'zod';
import { NodeError } from '@/contracts/errors';
import { COMPOSITION_ENTRY, type Composition } from '@/contracts/types/composition';
import { LIBRARY_MANIFEST, libraryComponentPath, type Library } from '@/contracts/types/library';
import type { NodeDefinition } from '@/core/nodes/definition';
import { CompositionErrorCode } from './errors';
import type { Inspection } from './server';
import { STARTER_INDEX } from './starter';

/**
 * The kit with the library's components added under `compositions/components/`. A component the kit
 * already has keeps the kit's file: the template is the authority on its own parts, and a shelf grows
 * only what the kit lacks.
 */
export function withLibrary(files: Record<string, string>, shelf: Library | undefined): Record<string, string> {
  if (!shelf) return files;
  const out = { ...files };
  const taken: string[] = [];
  for (const item of shelf.items) {
    const at = libraryComponentPath(item.name);
    if (out[at] !== undefined) continue;
    out[at] = item.html;
    taken.push(item.name);
  }
  // Which components came from the shelf rather than the kit: a node downstream that asks what the kit
  // lacks (the Forge) reads the kit's own parts, and a shelf that grew is not a different kit.
  // It names the shelf even when it took nothing: a node that adds to the shelf adds to this one.
  out[LIBRARY_MANIFEST] = JSON.stringify({ scope: shelf.scope, components: taken });
  return out;
}

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
  type: 'composition',
  version: 1,
  kind: 'source',
  /** The components the template's videos have gathered: they join the kit, and the kit's own file wins a name. */
  inputs: [{ name: 'library', type: 'Library', required: false }],
  outputs: [{ name: 'composition', type: 'Composition' }],
  paramsSchema: Params,
  defaultParams: { files: { [COMPOSITION_ENTRY]: STARTER_INDEX }, media: {} },
  validate: (params) => (params.files[COMPOSITION_ENTRY]?.trim() ? [] : [{ code: CompositionErrorCode.COMPOSITION_INVALID, message: `the project has no ${COMPOSITION_ENTRY}` }]),
  run: async ({ params, inputs, services, log }) => {
    if (!params.files[COMPOSITION_ENTRY]?.trim()) {
      throw new NodeError(CompositionErrorCode.COMPOSITION_INVALID, `the project has no ${COMPOSITION_ENTRY}`).withFix(`add an ${COMPOSITION_ENTRY} to the composition`);
    }
    const shelf = inputs.library?.payload as Library | undefined;
    const files = withLibrary(params.files, shelf);
    const added = Object.keys(files).length - Object.keys(params.files).length;
    if (shelf) log('info', `${added} components from the ${shelf.scope} library${added < shelf.items.length ? ` · ${shelf.items.length - added} already in the kit` : ''}`);
    const inspection = await services.invoke<Inspection>('composition/inspect', [files]);
    const errors = inspection.findings.filter((f) => f.severity === 'error');
    // The linter's codes are its own, not NodeCine's: the card shows one warning of ours, the log each finding.
    const warnings = inspection.findings.filter((x) => x.severity === 'warning');
    for (const f of warnings) log('info', `${f.file ? `${f.file} · ` : ''}${f.code}: ${f.message}`);
    if (warnings.length) log('warn', `HyperFrames lint: ${warnings.length} warning${warnings.length > 1 ? 's' : ''}`, CompositionErrorCode.COMPOSITION_LINT_WARNINGS);
    if (errors.length) {
      const first = errors[0]!;
      throw new NodeError(
        CompositionErrorCode.COMPOSITION_INVALID,
        `${first.file ? `${first.file}: ` : ''}${first.message}${errors.length > 1 ? ` (and ${errors.length - 1} more)` : ''}`,
        false,
        errors,
      ).withFix(first.fixHint ?? 'fix the composition and run again');
    }
    const out: Composition = {
      engine: 'hyperframes',
      width: inspection.width ?? 1080,
      height: inspection.height ?? 1920,
      fps: 30,
      files,
      media: params.media as Composition['media'],
      variables: inspection.variables,
      values: {},
    };
    log('info', `${out.width}×${out.height} · ${Object.keys(out.files).length} files · ${out.variables.length} variables`);
    return { composition: out };
  },
};
