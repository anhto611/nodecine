import { describe, expect, it } from 'vitest';
import { stat } from 'node:fs/promises';
import { createServerServices } from '../services.server';
import { buildCaptionTrack, retime } from '@/nodes/captions/cues';
import { buildIR } from '@/nodes/assembler/build-ir';
import { mediaUrl } from '../paths';
import staticScript from '@/lib/first-run.json';
import type { BlockDef, StageDef } from '@/core/types/payloads';

/**
 * Manual: real alignment (stable-ts) on a real voice-over, then a real producer render with karaoke
 * captions. Enable with NODECINE_MANUAL_CAPTIONS=1; point NODECINE_MANUAL_AUDIO at an mp3 in the
 * tmp dir (file name only), NODECINE_MANUAL_TEXT at its narration, NODECINE_MANUAL_DURATION at its
 * length in seconds. Prints the MP4 path.
 */
const enabled = process.env.NODECINE_MANUAL_CAPTIONS === '1';

describe.skipIf(!enabled)('captions, for real', () => {
  it('aligns, lays out, renders', async () => {
    const services = createServerServices();
    const file = process.env.NODECINE_MANUAL_AUDIO!;
    const text = process.env.NODECINE_MANUAL_TEXT!;
    const durationSeconds = Number(process.env.NODECINE_MANUAL_DURATION ?? '3');
    const audioUrl = mediaUrl(file);
    const heard = await services.alignWords(audioUrl, text, 'vi-VN', { model: 'small' }, new AbortController().signal);
    const words = retime(text, heard);
    console.log('words', words.map((w) => `${w.text}@${w.start}`).join(' '));
    const track = buildCaptionTrack(words, { maxChars: 26 });
    console.log('lines', track.cues.map((c) => c.words.map((w) => w.text).join(' ')));
    const nodes = staticScript.graph.nodes;
    const stage = nodes.find((n) => n.type === 'core/art-director')!.params as unknown as StageDef;
    const blocks = (nodes.find((n) => n.type === 'core/art-director')!.params as unknown as { blocks: BlockDef[] }).blocks;
    const ir = buildIR({
      plan: { language: 'vi', stage, blocks, scenes: [{ blockId: 'text-card', weight: 1, props: { headline: 'Phụ đề karaoke', body: 'Căn mốc từ bằng stable-ts' }, fields: { kicker: 'NodeCine' } }] },
      voiceover: { audioUrl, durationSeconds, voiceName: 'vbee', language: 'vi-VN', speed: 1, words },
      captions: track,
      params: { title: 'Captions check', minTotalFrames: 30 },
    });
    const engine = await services.probeEngine('hyperframes', {});
    const resolution = (process.env.NODECINE_MANUAL_RESOLUTION ?? '1080p') as '1080p' | '1440p' | '2160p';
    const out = await services.render(engine, ir, { codec: 'h264', quality: 'high', fileName: 'captions-check.mp4', resolution }, () => undefined, new AbortController().signal);
    console.log('mp4', out.outputUrl, out.bytes);
    expect((await stat(`.nodecine/tmp/${out.outputUrl.split('/').pop()}`)).size).toBeGreaterThan(10_000);
  }, 600_000);
});
