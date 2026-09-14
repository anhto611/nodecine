import { z } from 'zod';
import { NodeError } from '@/contracts/errors';
import type { AudioScript } from '@/contracts/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';
import { ScriptErrorCode } from './errors';

/** Script languages offered on the node; any BCP 47 tag works in a saved workflow. */
export const SCRIPT_LANGUAGES = ['vi', 'en'] as const;

const Params = z.object({
  /** The narration as it will be read. A blank line starts the next segment. */
  text: z.string().max(20_000).default(''),
  language: z.string().min(2).max(35).default('vi'),
});

/** The segments of a narration: its paragraphs, each flattened to one line. */
export function segmentsOf(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * A narration someone wrote or pasted. Each paragraph is a segment: the TTS node voices them one by
 * one and joins them, so a composition can time its scenes to where each segment starts.
 */
export const script: NodeDefinition<typeof Params> = {
  type: 'script', version: 1, kind: 'source',
  inputs: [],
  outputs: [{ name: 'script', type: 'AudioScript' }],
  paramsSchema: Params, defaultParams: { text: '', language: 'vi' },
  validate: (params) => (segmentsOf(params.text).length ? [] : [{ code: ScriptErrorCode.SCRIPT_EMPTY, message: 'the script is empty' }]),
  run: async ({ params, log }) => {
    const segments = segmentsOf(params.text);
    if (!segments.length) throw new NodeError(ScriptErrorCode.SCRIPT_EMPTY, 'the script is empty').withFix('paste the narration into the Script node');
    log('info', `${segments.length} segments · ${segments.join(' ').split(' ').length} words · ${params.language}`);
    return { script: { text: segments.join(' '), language: params.language, segments } satisfies AudioScript };
  },
};
