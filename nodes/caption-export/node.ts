import { z } from 'zod';
import { CaptionExportErrorCode } from './errors';
import { safeFileName } from '@/contracts/file-name';
import type { NodeDefinition } from '@/core/nodes/definition';
import type { CaptionTrack } from '@/contracts/types/payloads';
import { SUBTITLE_FORMATS, toSubtitles } from './subtitles';
import { NodeError } from '@/contracts/errors';

const Params = z.object({ format: z.enum(SUBTITLE_FORMATS).default('srt'), fileName: z.string().min(1).max(80).default('nodecine') });
export const captionExport: NodeDefinition<typeof Params> = {
  type: 'core/caption-export', version: 1, kind: 'sink',
  inputs: [{ name: 'captions', type: 'CaptionTrack' }], outputs: [],
  paramsSchema: Params, defaultParams: { format: 'srt', fileName: 'nodecine' },
  run: async ({ params, inputs, services, log }) => {
    const track = inputs.captions!.payload as CaptionTrack;
    if (!track.cues.length) throw new NodeError(CaptionExportErrorCode.CAPTIONS_EMPTY, 'the caption track has no lines').withFix('run Captions on a timed voice-over');
    const text = toSubtitles(track, params.format);
    const fileName = safeFileName(params.fileName, 'nodecine', params.format);
    const { url, bytes } = await services.saveText(text, params.format);
    log('info', `${track.cues.length} lines · ${bytes} bytes · ${fileName}`);
    return { outputUrl: url, bytes, fileName, lines: track.cues.length };
  },
};
