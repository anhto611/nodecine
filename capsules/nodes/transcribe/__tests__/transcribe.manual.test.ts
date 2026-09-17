import { describe, expect, it } from 'vitest';
import { alignWordsOnServer } from '../server';
import { importAudioFile } from '@/server/contracts/audio';
import { ensureServerRegistrations } from '@/server/contracts/register';

/**
 * Manual, with the real model: the same recording timed both ways. Enabled with
 * NODECINE_MANUAL_TRANSCRIBE=1 and the path of a recording in NODECINE_MANUAL_VOICE.
 * The half that matters is the second: with no text on stdin the model has to hear the words, which
 * is the only way a recording made outside this app can ever have captions.
 */
const enabled = process.env.NODECINE_MANUAL_TRANSCRIBE === '1';

describe.skipIf(!enabled)('word timings, for real', () => {
  it('transcribes a recording nobody wrote a script for', async () => {
    ensureServerRegistrations();
    const file = process.env.NODECINE_MANUAL_VOICE ?? 'ban-thu-san.mp3';
    const { audioUrl, durationSeconds } = await importAudioFile(file, new AbortController().signal);
    const { words: heard, language } = await alignWordsOnServer(audioUrl, '', 'und', { model: 'small' }, new AbortController().signal);
    console.log(`HEARD ${heard.length} words of ${language} in ${durationSeconds}s · ${heard.slice(0, 12).map((w) => w.text).join(' ')}`);
    expect(heard.length).toBeGreaterThan(5);
    // Timings have to be inside the recording and in order, or captions land anywhere.
    expect(heard[0]!.start).toBeGreaterThanOrEqual(0);
    expect(heard.at(-1)!.end).toBeLessThanOrEqual(durationSeconds + 1);
    for (let i = 1; i < heard.length; i++) expect(heard[i]!.start).toBeGreaterThanOrEqual(heard[i - 1]!.start - 0.001);
  }, 1_800_000);
});
