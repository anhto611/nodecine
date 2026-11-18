import os from 'node:os';
import path from 'node:path';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { Capability, Voice } from '@/contracts/types/payloads';
import type { SynthesizeResult } from '@/contracts/providers/types';
import { convertToMp3, ffmpegBin, measureDurationSeconds } from '@/server/contracts/audio';
import { ensureTmpDir } from '@/server/paths';
import { contentHash } from '@/core/hash';

/**
 * What the voices that run in a process of their own share: Kokoro on Node, VieNeu and OmniVoice on
 * Python. Each is a worker that loads its model once and then answers one JSON line per request, so a
 * film with eight scenes loads the model once rather than eight times. The worker stays up between
 * requests and goes away after a few idle minutes.
 *
 * Belongs to no provider: `capsules/providers/*.ts` files are the kind's shared parts.
 */

export const ready: Capability = { status: 'ready' };
export const missing = (reason: string, fix: string): Capability => ({ status: 'unavailable', code: 'PROVIDER_NOT_INSTALLED', reason, fix });

/** NodeCine's own folder for the tools a setup script installs. */
export const toolsDir = (name: string): string => path.resolve(process.cwd(), '.nodecine', 'tools', name);
/** A provider's own files (worker, library lock, model list), beside its code. */
export const providerFile = (provider: string, file: string): string => path.resolve(process.cwd(), 'capsules', 'providers', provider, file);

/** The machine's Hugging Face hub cache, shared with every program that uses it, so a model is never stored twice. */
export const hfHub = (): string =>
  path.resolve(
    process.env.HF_HUB_CACHE || process.env.HUGGINGFACE_HUB_CACHE || (process.env.HF_HOME ? path.join(process.env.HF_HOME, 'hub') : path.join(os.homedir(), '.cache', 'huggingface', 'hub')),
  );

export interface PinnedModel {
  repo: string;
  commit: string;
  files: { path: string; size: number; sha256: string }[];
}

/** Every file of the pinned commit is in the hub, at its size: the setup script checked their hashes when it fetched them. */
export function modelsPresent(models: PinnedModel[]): boolean {
  return models.every((m) => {
    const snap = path.join(hfHub(), `models--${m.repo.split('/').join('--')}`, 'snapshots', m.commit);
    return m.files.every((f) => {
      try {
        return statSync(path.join(snap, f.path)).size === f.size;
      } catch {
        return false;
      }
    });
  });
}

/** The environment a Python worker runs in: the models offline, at the pinned commits. */
export const pythonEnv = (models: PinnedModel[]): Record<string, string> => ({
  HF_HUB_CACHE: hfHub(),
  HF_HUB_OFFLINE: '1',
  HF_HUB_DISABLE_SYMLINKS_WARNING: '1',
  PYTHONUTF8: '1',
  PYTHONIOENCODING: 'utf-8',
  PYTORCH_ENABLE_MPS_FALLBACK: '1',
  NODECINE_HF_PINS: JSON.stringify(Object.fromEntries(models.map((m) => [m.repo, m.commit]))),
});

export interface PythonEnv {
  python: string;
  /** Arguments that start `worker` with this environment's libraries and nothing from the person's own Python setup. */
  args: (worker: string) => string[];
}

const BOOT = "import runpy,site,sys;site.addsitedir(sys.argv[1]);w=sys.argv[2];sys.argv=[w];runpy.run_path(w,run_name='__main__')";
const isWin = process.platform === 'win32';

/**
 * A Python environment whose libraries hold `pkg`: `dir` itself, or its venv/.venv/env folder. It runs on
 * the environment's base interpreter with its site-packages added, the way it would inside the venv.
 */
export function findPythonEnv(dir: string, pkg: string): PythonEnv | null {
  for (const root of [dir, path.join(dir, '.venv'), path.join(dir, 'venv'), path.join(dir, 'env')]) {
    let sites: string[] = [];
    if (isWin) sites = [path.join(root, 'Lib', 'site-packages')];
    else {
      try {
        sites = readdirSync(path.join(root, 'lib'))
          .filter((d) => /^python3\.\d+$/.test(d))
          .map((d) => path.join(root, 'lib', d, 'site-packages'));
      } catch {
        /* not this folder */
      }
    }
    const site = sites.find((s) => existsSync(path.join(s, pkg)));
    if (!site) continue;
    let python = '';
    try {
      const home = /^home\s*=\s*(.+)$/m.exec(readFileSync(path.join(root, 'pyvenv.cfg'), 'utf8'))?.[1]?.trim();
      if (home) python = path.join(home, isWin ? 'python.exe' : 'python3');
    } catch {
      python = path.join(root, isWin ? 'python.exe' : 'bin/python3');
    }
    if (python && existsSync(python)) return { python, args: (worker) => ['-E', '-s', '-X', 'utf8', '-c', BOOT, site, worker] };
  }
  return null;
}

/** The first of these folders that holds an environment with `pkg`, and the folder it was found in. */
export function locatePythonEnv(dirs: (string | undefined)[], pkg: string): { dir: string; env: PythonEnv } | null {
  for (const dir of dirs) {
    if (!dir || !existsSync(dir)) continue;
    const env = findPythonEnv(dir, pkg);
    if (env) return { dir, env };
  }
  return null;
}

/** Where another app on this machine keeps a voice it installed, so NodeCine uses that copy instead of installing a second. */
export function sharedVoiceDir(voice: string): string | undefined {
  const home = path.join(os.homedir(), '.aikenh');
  try {
    const settings = JSON.parse(readFileSync(path.join(home, 'settings.json'), 'utf8')) as { voices?: Record<string, { dir?: string }> };
    const dir = settings.voices?.[voice]?.dir;
    if (dir) return dir;
  } catch {
    /* no such app here */
  }
  const tools = path.join(home, 'tools', voice);
  return existsSync(tools) ? tools : undefined;
}

// ---------- the long-lived workers ----------

interface Worker {
  child: ChildProcessWithoutNullStreams;
  ready: Promise<void>;
  queue: Promise<unknown>;
  idle: ReturnType<typeof setTimeout> | null;
  pending: ((line: string) => void)[];
  stderr: string;
}

const IDLE_MS = 5 * 60_000;
const workers: Map<string, Worker> = ((globalThis as { __nodecineVoiceWorkers?: Map<string, Worker> }).__nodecineVoiceWorkers ??= new Map());

function start(key: string, cmd: string, args: string[], env: Record<string, string>): Worker {
  const child = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const worker: Worker = { child, ready: Promise.resolve(), queue: Promise.resolve(), idle: null, pending: [], stderr: '' };
  let buffer = '';
  let markReady: () => void = () => {};
  let failReady: (e: Error) => void = () => {};
  worker.ready = new Promise<void>((resolve, reject) => {
    markReady = resolve;
    failReady = reject;
  });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    let at: number;
    while ((at = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, at).trim();
      buffer = buffer.slice(at + 1);
      if (!line.startsWith('{')) continue;
      // The first line a worker prints says its model is loaded; every later one answers a request.
      if (line.includes('"ready"')) markReady();
      else worker.pending.shift()?.(line);
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    worker.stderr = (worker.stderr + chunk).slice(-4000);
  });
  const gone = (why: string) => {
    workers.delete(key);
    const error = new Error(`${why}${worker.stderr.trim() ? `: ${worker.stderr.trim().split('\n').slice(-3).join(' ')}` : ''}`);
    failReady(error);
    for (const reply of worker.pending.splice(0)) reply(JSON.stringify({ ok: false, error: error.message }));
  };
  child.on('error', (e) => gone(`the voice could not start (${e.message})`));
  child.on('exit', (code) => gone(`the voice stopped (exit ${code})`));
  child.stdin.on('error', () => {});
  workers.set(key, worker);
  return worker;
}

/**
 * Ask a worker one thing and wait for its answer. Requests to one worker go one at a time, the way its
 * loop reads them. Stopping a run kills the worker: it may be halfway through a long sentence.
 */
export async function askWorker<T>(key: string, launch: { cmd: string; args: string[]; env: Record<string, string> }, request: Record<string, unknown>, signal: AbortSignal): Promise<T> {
  const worker = workers.get(key) ?? start(key, launch.cmd, launch.args, launch.env);
  if (worker.idle) clearTimeout(worker.idle);
  const turn = worker.queue.then(async () => {
    if (signal.aborted) throw Object.assign(new Error('cancelled'), { code: 'CANCELLED' });
    await worker.ready;
    const answer = new Promise<string>((resolve) => worker.pending.push(resolve));
    const onAbort = () => worker.child.kill();
    signal.addEventListener('abort', onAbort, { once: true });
    worker.child.stdin.write(`${JSON.stringify(request)}\n`);
    try {
      return JSON.parse(await answer) as T & { ok?: boolean; error?: string };
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  });
  worker.queue = turn.catch(() => undefined);
  const result = await turn;
  if (workers.get(key) === worker) worker.idle = setTimeout(() => worker.child.kill(), IDLE_MS);
  if (!result.ok) throw Object.assign(new Error(result.error || 'the voice failed'), { code: 'PROVIDER_PROCESS_FAILED' });
  return result;
}

export async function encoder(): Promise<Capability> {
  return (await ffmpegBin()) ? ready : missing('ffmpeg was not found', 'brew install ffmpeg');
}

/** A WAV path for this request, named by what is said and how, and the MP3 the node is handed. */
export async function outputFor(provider: string, key: Record<string, unknown>): Promise<{ wav: string; mp3: string }> {
  const dir = await ensureTmpDir();
  const name = contentHash({ provider, ...key });
  return { wav: path.join(dir, `${name}.wav`), mp3: path.join(dir, `${name}.mp3`) };
}

export async function finishMp3(wav: string, mp3: string, voice: Voice, signal: AbortSignal): Promise<SynthesizeResult> {
  await convertToMp3(wav, `${mp3}.part`, signal);
  await rename(`${mp3}.part`, mp3);
  const durationSeconds = await measureDurationSeconds(mp3, signal).catch((e) => {
    throw Object.assign(e instanceof Error ? e : new Error(String(e)), { code: 'TTS_AUDIO_UNREADABLE' });
  });
  return { filePath: mp3, durationSeconds, voice };
}
