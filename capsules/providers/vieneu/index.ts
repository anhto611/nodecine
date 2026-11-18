import { readFileSync } from 'node:fs';
import { registerTTSProvider } from '@/contracts/providers/registry';
import type { SynthesizeResult, TTSProvider } from '@/contracts/providers/types';
import type { Voice } from '@/contracts/types/payloads';
import { askWorker, encoder, finishMp3, locatePythonEnv, missing, modelsPresent, outputFor, providerFile, pythonEnv, ready, sharedVoiceDir, toolsDir, type PinnedModel } from '../voice-workers';
import { vieneuSettings } from './settings';

/**
 * VieNeu-TTS (Apache-2.0): ready-made Vietnamese voices, run locally on Python. The libraries and the
 * model are pinned by hash and installed once by the setup script; an install another app on this
 * machine already made is used as it is.
 */

export const VIENEU_ID = 'vieneu';
const SETUP = 'npm run setup:vieneu';

interface Pinned {
  voices: string[];
  models: PinnedModel[];
}
const pinned = (): Pinned => JSON.parse(readFileSync(providerFile(VIENEU_ID, 'models.json'), 'utf8')) as Pinned;

/** The voice a node left on automatic starts with: a plain, clear narrator. */
const FIRST = 'Hải Đăng';
/** Character voices that are never a sensible default; listed last. */
const NOVELTY = new Set(['Adam bựa']);

/** The pinned voices, the default first and the character voices last; the rest as the model lists them. */
export const vieneuVoices = (): Voice[] => {
  const rank = (name: string) => (name === FIRST ? 0 : NOVELTY.has(name) ? 2 : 1);
  return [...pinned().voices].sort((a, b) => rank(a) - rank(b)).map((name) => ({ id: name, displayName: name, language: 'vi' }));
};

export const locateVieneu = () => locatePythonEnv([process.env.NODECINE_VIENEU_DIR, toolsDir(VIENEU_ID), sharedVoiceDir(VIENEU_ID)], 'vieneu');

export function createVieneuProvider(settings: Record<string, unknown>): TTSProvider {
  return {
    providerId: VIENEU_ID,
    displayName: 'VieNeu',
    transport: 'local',

    async probe() {
      const installed = !locateVieneu() ? missing('The VieNeu voice is not installed', SETUP) : !modelsPresent(pinned().models) ? missing('The VieNeu voice model is not downloaded', SETUP) : ready;
      return { capabilities: { installed, encoder: await encoder() }, voices: vieneuVoices() };
    },

    async synthesize(text, voice, _speed, signal): Promise<SynthesizeResult> {
      const found = locateVieneu();
      if (!found) throw Object.assign(new Error('the VieNeu voice is not installed'), { code: 'PROVIDER_NOT_INSTALLED', fix: SETUP });
      const temperature = (settings.expressive as number | undefined) ?? 0.8;
      const { wav, mp3 } = await outputFor(VIENEU_ID, { text, voice: voice.id, temperature });
      const worker = providerFile(VIENEU_ID, 'vieneu_worker.py');
      await askWorker(
        `${VIENEU_ID}:${found.dir}`,
        { cmd: found.env.python, args: found.env.args(worker), env: pythonEnv(pinned().models) },
        { text, voice: voice.id, out: wav, pause: 0.28, temperature },
        signal,
      );
      return finishMp3(wav, mp3, voice, signal);
    },
  };
}

export function registerVieneu(): void {
  registerTTSProvider({ id: VIENEU_ID, displayName: 'VieNeu', factory: createVieneuProvider, autoRank: 2, settingsSchema: vieneuSettings });
}
