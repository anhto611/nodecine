import { z } from 'zod';
import { ErrorCode } from '@/core/errors';
import type { NodeDefinition } from '@/core/nodes/definition';
import { OUTPUT_LANGUAGES } from '@/core/text/languages';

const LANGUAGES = OUTPUT_LANGUAGES.filter((language) => language !== 'auto') as [string, ...string[]];
const Params = z.object({
  file: z.string().max(120).default(''),
  language: z.enum(LANGUAGES).default('en'),
});

export const audioInput: NodeDefinition<typeof Params> = {
  type: 'core/audio-input', version: 1, kind: 'source', inputs: [],
  outputs: [{ name: 'voiceover', type: 'Voiceover' }],
  paramsSchema: Params, defaultParams: { file: '', language: 'en' },
  validate: (params) => params.file.trim() ? [] : [{ code: ErrorCode.INPUT_EMPTY, message: 'choose a recording' }],
  run: async ({ params, services, signal, log }) => {
    const file = params.file.trim();
    const { audioUrl, durationSeconds } = await services.importAudio(file, signal);
    log('info', `${file} · ${durationSeconds.toFixed(2)}s · ${params.language}`);
    return { voiceover: { audioUrl, durationSeconds, voiceName: file, language: params.language, speed: 1 } };
  },
};
