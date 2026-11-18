import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { exec } from '@/server/exec';
import { registerTTSProvider } from '@/contracts/providers/registry';
import type { SynthesizeResult, TTSProvider } from '@/contracts/providers/types';
import type { Voice } from '@/contracts/types/payloads';
import { askWorker, encoder, finishMp3, outputFor, providerFile, ready, toolsDir } from '../voice-workers';
import { kokoroSettings } from './settings';

/**
 * Kokoro: a small local neural voice in eight languages, run by sherpa-onnx on Node — no Python, no key,
 * the same on every platform. It took the place of Piper and of the OS voice on 2026-11-18, and it is
 * the voice that works with nothing set up: its model (132 MB) downloads by itself the first time it
 * reads. It speaks no Vietnamese; VieNeu does.
 */

export const KOKORO_ID = 'kokoro';
export const KOKORO_MODEL = 'kokoro-int8-multi-lang-v1_0';
const MODEL_URL = `https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/${KOKORO_MODEL}.tar.bz2`;
const MODEL_SHA256 = '72c347230107ef8a31098ec4d468a605244beef5f1ed00db97efa13518800653';

/** In the model's own order: a voice's place in this list is its speaker id. */
export const KOKORO_VOICES =
  'af_alloy,af_aoede,af_bella,af_heart,af_jessica,af_kore,af_nicole,af_nova,af_river,af_sarah,af_sky,am_adam,am_echo,am_eric,am_fenrir,am_liam,am_michael,am_onyx,am_puck,am_santa,bf_alice,bf_emma,bf_isabella,bf_lily,bm_daniel,bm_fable,bm_george,bm_lewis,ef_dora,em_alex,ff_siwis,hf_alpha,hf_beta,hm_omega,hm_psi,if_sara,im_nicola,jf_alpha,jf_gongitsune,jf_nezumi,jf_tebukuro,jm_kumo,pf_dora,pm_alex,pm_santa,zf_xiaobei,zf_xiaoni,zf_xiaoxiao,zf_xiaoyi,zm_yunjian,zm_yunxi,zm_yunxia,zm_yunyang,em_santa'.split(
    ',',
  );
/** The first letter of a voice's name is its language. */
const LANGUAGES: Record<string, string> = { a: 'en-US', b: 'en-GB', e: 'es', f: 'fr-FR', h: 'hi', i: 'it', j: 'ja', p: 'pt-BR', z: 'zh' };

/** `af_heart` → Heart, in American English. */
export function kokoroVoice(id: string): Voice {
  const name = id.slice(3);
  return { id, displayName: `${name.charAt(0).toUpperCase()}${name.slice(1)} · ${id[1] === 'f' ? '♀' : '♂'}`, language: LANGUAGES[id[0]!] ?? 'en' };
}

/** The model folder: NodeCine's own, or a copy another app on this machine already downloaded. */
export function kokoroModelDir(): string | null {
  const candidates = [process.env.NODECINE_KOKORO_DIR, path.join(toolsDir('kokoro'), KOKORO_MODEL), path.join(os.homedir(), '.aikenh', 'cache', 'kokoro', KOKORO_MODEL)];
  return candidates.find((d): d is string => !!d && existsSync(path.join(d, 'model.int8.onnx'))) ?? null;
}

let downloading: Promise<string> | null = null;

/**
 * The model folder, downloaded and checked against its pinned hash the first time it is needed. One
 * download at a time, however many scenes ask at once; unpacked beside its final place and renamed
 * into it, so a folder that exists is a whole model.
 */
export function ensureKokoroModel(): Promise<string> {
  const have = kokoroModelDir();
  if (have) return Promise.resolve(have);
  downloading ??= (async () => {
    const root = toolsDir('kokoro');
    await mkdir(root, { recursive: true });
    const work = await mkdtemp(path.join(root, 'download-'));
    try {
      const res = await fetch(MODEL_URL);
      if (!res.ok || !res.body) throw Object.assign(new Error(`could not download the Kokoro model (HTTP ${res.status})`), { code: 'PROVIDER_NOT_INSTALLED' });
      const archive = path.join(work, 'model.tar.bz2');
      const hash = crypto.createHash('sha256');
      await pipeline(
        Readable.fromWeb(res.body as never),
        new Transform({
          transform(chunk: Buffer, _e, cb) {
            hash.update(chunk);
            cb(null, chunk);
          },
        }),
        createWriteStream(archive),
      );
      if (hash.digest('hex') !== MODEL_SHA256) throw Object.assign(new Error('the downloaded Kokoro model failed its SHA-256 check'), { code: 'PROVIDER_NOT_INSTALLED' });
      const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe') : 'tar';
      const r = await exec(tar, { args: ['-xjf', archive, '-C', work], timeoutMs: 300_000 });
      if (r.code !== 0) throw Object.assign(new Error(`could not unpack the Kokoro model: ${r.stderr.trim().slice(-300)}`), { code: 'PROVIDER_NOT_INSTALLED' });
      const dir = path.join(root, KOKORO_MODEL);
      await rename(path.join(work, KOKORO_MODEL), dir).catch((e) => {
        if (!existsSync(dir)) throw e;
      });
      return dir;
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  })().finally(() => {
    downloading = null;
  });
  return downloading;
}

export function createKokoroProvider(settings: Record<string, unknown>): TTSProvider {
  return {
    providerId: KOKORO_ID,
    displayName: 'Kokoro',
    transport: 'local',

    async probe() {
      // Ready either way: a model not yet here downloads by itself the first time Kokoro reads.
      const installed = ready;
      return { capabilities: { installed, encoder: await encoder() }, voices: KOKORO_VOICES.map(kokoroVoice) };
    },

    async synthesize(text, voice, speed, signal): Promise<SynthesizeResult> {
      const dir = await ensureKokoroModel();
      const sid = KOKORO_VOICES.indexOf(voice.id);
      if (sid < 0) throw Object.assign(new Error(`Kokoro has no voice "${voice.id}"`), { code: 'PROVIDER_PROCESS_FAILED' });
      const pace = Math.min(2, Math.max(0.5, speed * ((settings.rate as number | undefined) ?? 1)));
      const { wav, mp3 } = await outputFor(KOKORO_ID, { text, voice: voice.id, pace });
      await askWorker(`${KOKORO_ID}:${dir}`, { cmd: process.execPath, args: [providerFile('kokoro', 'worker.mjs'), dir], env: {} }, { text, sid, speed: pace, out: wav }, signal);
      return finishMp3(wav, mp3, voice, signal);
    },
  };
}

export function registerKokoro(): void {
  registerTTSProvider({ id: KOKORO_ID, displayName: 'Kokoro', factory: createKokoroProvider, autoRank: 1, settingsSchema: kokoroSettings });
}
