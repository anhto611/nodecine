import path from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { registerTTSProvider } from '@/contracts/providers/registry';
import type { SynthesizeResult, TTSProvider } from '@/contracts/providers/types';
import type { Voice } from '@/contracts/types/payloads';
import { askWorker, encoder, finishMp3, locatePythonEnv, missing, modelsPresent, outputFor, providerFile, pythonEnv, ready, sharedVoiceDir, toolsDir, type PinnedModel } from '../voice-workers';
import { omnivoiceSettings } from './settings';

/**
 * OmniVoice (k2-fsa, Apache-2.0): speaks in the voice of a short sample, in any language. It is an add-on
 * of about 8 GB (PyTorch and the model), so it is never installed without being asked for: the setup
 * script installs it, or an install already on this machine is used as it is.
 *
 * Its voices are samples a person keeps in `.nodecine/voices/`: an audio file of 3 to 10 seconds, and
 * beside it a `.txt` with the exact words spoken in it. Use only your own voice, or one you may use.
 */

export const OMNIVOICE_ID = 'omnivoice';
const SETUP = 'npm run setup:omnivoice';
const AUDIO = /\.(wav|mp3|m4a|flac|ogg)$/i;

const pinned = (): { models: PinnedModel[] } => JSON.parse(readFileSync(providerFile(OMNIVOICE_ID, 'models.json'), 'utf8')) as { models: PinnedModel[] };

export const voicesDir = (): string => path.resolve(process.cwd(), process.env.NODECINE_VOICES_DIR ?? '.nodecine/voices');

/** A sample counts as a voice once the words spoken in it sit beside it. */
export function sampleVoices(dir = voicesDir()): (Voice & { sample: string; words: string })[] {
  let files: string[] = [];
  try {
    files = readdirSync(dir);
  } catch {
    return [];
  }
  return files
    .filter((f) => AUDIO.test(f))
    .flatMap((f) => {
      const name = f.replace(AUDIO, '');
      let words = '';
      try {
        words = readFileSync(path.join(dir, `${name}.txt`), 'utf8').trim();
      } catch {
        return [];
      }
      // `mul`: a cloned voice speaks whatever language the script is in.
      return words ? [{ id: name, displayName: name, language: 'mul', sample: path.join(dir, f), words }] : [];
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export const locateOmnivoice = () => locatePythonEnv([process.env.NODECINE_OMNIVOICE_DIR, toolsDir(OMNIVOICE_ID), sharedVoiceDir(OMNIVOICE_ID)], 'omnivoice');

export function createOmnivoiceProvider(settings: Record<string, unknown>): TTSProvider {
  return {
    providerId: OMNIVOICE_ID,
    displayName: 'OmniVoice',
    transport: 'local',

    async probe() {
      const voices = sampleVoices();
      const installed = !locateOmnivoice()
        ? missing('The OmniVoice add-on is not installed (about 8 GB)', SETUP)
        : !modelsPresent(pinned().models)
          ? missing('The OmniVoice model is not downloaded', SETUP)
          : voices.length === 0
            ? missing(`No voice samples in ${voicesDir()}`, 'put a 3–10 second recording there, and beside it a .txt of the same name with the exact words spoken')
            : ready;
      return { capabilities: { installed, encoder: await encoder() }, voices: voices.map(({ id, displayName, language }) => ({ id, displayName, language })) };
    },

    async synthesize(text, voice, speed, signal): Promise<SynthesizeResult> {
      const found = locateOmnivoice();
      if (!found) throw Object.assign(new Error('the OmniVoice add-on is not installed'), { code: 'PROVIDER_NOT_INSTALLED', fix: SETUP });
      const sample = sampleVoices().find((v) => v.id === voice.id);
      if (!sample) throw Object.assign(new Error(`no voice sample "${voice.id}" in ${voicesDir()}`), { code: 'PROVIDER_PROCESS_FAILED' });
      const pace = Math.min(2, Math.max(0.5, speed * ((settings.rate as number | undefined) ?? 1)));
      const sampled = existsSync(sample.sample) ? readFileSync(sample.sample).byteLength : 0;
      const { wav, mp3 } = await outputFor(OMNIVOICE_ID, { text, voice: voice.id, words: sample.words, sampled, pace });
      const worker = providerFile(OMNIVOICE_ID, 'omnivoice_worker.py');
      await askWorker(
        `${OMNIVOICE_ID}:${found.dir}`,
        { cmd: found.env.python, args: found.env.args(worker), env: pythonEnv(pinned().models) },
        { text, ref: sample.sample, refText: sample.words, out: wav, lang: null, speed: pace === 1 ? null : pace, pause: 0.28 },
        signal,
      );
      return finishMp3(wav, mp3, voice, signal);
    },
  };
}

export function registerOmnivoice(): void {
  registerTTSProvider({ id: OMNIVOICE_ID, displayName: 'OmniVoice', factory: createOmnivoiceProvider, settingsSchema: omnivoiceSettings });
}
