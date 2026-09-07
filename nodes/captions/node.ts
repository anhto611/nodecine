import { z } from 'zod';
import type { Voiceover } from '@/core/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';
import { ErrorCode } from '@/core/errors';
import { safeFileName } from '@/core/file-name';
import { buildCaptionTrack } from '@/nodes/captions/cues';
import { SUBTITLE_FORMATS, toSubtitles } from '@/nodes/captions/subtitles';
import type { CaptionTrack } from '@/core/types/payloads';

const Params = z.object({
  /** Characters a line may hold: a measurement of the caption slot the stage draws, so it lives here, not there. */
  maxChars: z.number().int().min(8).max(80).default(26),
});

/**
 * CORE_CONTRACTS §5.13 — Voiceover with words → CaptionTrack. Pure.
 *
 * Only what is said and when. Where the lines sit, in which font, which colour the spoken word
 * turns: that is the stage's, declared on its `data-slot="captions"` element.
 */
export const captions: NodeDefinition<typeof Params> = {
  type: 'core/captions',
  version: 1,
  kind: 'process',
  inputs: [{ name: 'voiceover', type: 'Voiceover' }],
  outputs: [{ name: 'captions', type: 'CaptionTrack' }],
  paramsSchema: Params,
  defaultParams: { maxChars: 26 },
  run: async ({ params, inputs, log }) => {
    const voiceover = inputs.voiceover!.payload as Voiceover;
    if (!voiceover.words?.length) {
      throw Object.assign(new Error('the voice-over carries no word timings'), { code: ErrorCode.CAPTIONS_NO_WORDS, fix: 'wire the voice-over through a Transcribe node first' });
    }
    const track = buildCaptionTrack(voiceover.words, params);
    log('info', `${track.cues.length} lines from ${voiceover.words.length} words · ≤${params.maxChars} chars`);
    return { captions: track };
  },
};

const ExportParams = z.object({
  format: z.enum(SUBTITLE_FORMATS).default('srt'),
  /** Without an extension: the format decides that, so the two can never disagree. */
  fileName: z.string().min(1).max(80).default('nodecine'),
});

/**
 * CORE_CONTRACTS §5.16 — CaptionTrack → a subtitle file the browser downloads.
 *
 * The same lines the video burns in, as a file to upload beside it. Cheap enough to run with the
 * flow rather than on demand like the MP4: the words and their timings are already in hand, and all
 * this does is write them down.
 */
export const captionExport: NodeDefinition<typeof ExportParams> = {
  type: 'core/caption-export',
  version: 1,
  kind: 'sink',
  inputs: [{ name: 'captions', type: 'CaptionTrack' }],
  outputs: [],
  paramsSchema: ExportParams,
  defaultParams: { format: 'srt', fileName: 'nodecine' },
  run: async ({ params, inputs, services, log }) => {
    const track = inputs.captions!.payload as CaptionTrack;
    if (!track.cues.length) {
      throw Object.assign(new Error('the caption track has no lines'), { code: ErrorCode.CAPTIONS_NO_WORDS, fix: 'run the Captions node on a voice-over that carries word timings' });
    }
    const text = toSubtitles(track, params.format);
    const fileName = safeFileName(params.fileName, 'nodecine', params.format);
    const { url, bytes } = await services.saveText(text, params.format);
    log('info', `${track.cues.length} lines · ${bytes} bytes · ${fileName}`);
    return { outputUrl: url, bytes, fileName, lines: track.cues.length };
  },
};
