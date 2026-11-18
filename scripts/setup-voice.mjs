// Installs one local voice for the TTS node: `node scripts/setup-voice.mjs <kokoro|vieneu|omnivoice>`.
// Idempotent: what is already on this machine (here, or installed by another app) is used, not fetched again.
// Every download is checked against its pinned SHA-256. Python voices need `uv` (brew install uv).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const root = process.cwd();
const voice = process.argv[2];
const tools = (name) => path.join(root, '.nodecine', 'tools', name);
const providerFile = (p, f) => path.join(root, 'capsules', 'providers', p, f);
const hub = path.resolve(
  process.env.HF_HUB_CACHE || process.env.HUGGINGFACE_HUB_CACHE || (process.env.HF_HOME ? path.join(process.env.HF_HOME, 'hub') : path.join(os.homedir(), '.cache', 'huggingface', 'hub')),
);
const isWin = process.platform === 'win32';
const say = (s) => console.log(s);
const fail = (s) => {
  console.error(s);
  process.exit(1);
};
const run = (cmd, args, env = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) fail(`${cmd} ${args.join(' ')} failed`);
};

async function download(url, to, sha256) {
  const res = await fetch(url);
  if (!res.ok) fail(`could not download ${url} (HTTP ${res.status})`);
  const part = `${to}.part`;
  const hash = crypto.createHash('sha256');
  const total = Number(res.headers.get('content-length')) || 0;
  let got = 0;
  let shown = -1;
  await pipeline(
    Readable.fromWeb(res.body),
    new Transform({
      transform(chunk, _e, cb) {
        hash.update(chunk);
        got += chunk.length;
        const pct = total ? Math.floor((got / total) * 10) : -1;
        if (pct !== shown && pct >= 0) {
          shown = pct;
          process.stdout.write(`  ${pct * 10}%\r`);
        }
        cb(null, chunk);
      },
    }),
    fs.createWriteStream(part),
  );
  if (hash.digest('hex') !== sha256) {
    fs.rmSync(part, { force: true });
    fail(`${path.basename(to)} failed its SHA-256 check`);
  }
  fs.renameSync(part, to);
  process.stdout.write('\n');
}

/** A Python environment whose site-packages hold `pkg`: the folder, or its .venv/venv/env. */
function hasEnv(dir, pkg) {
  if (!dir || !fs.existsSync(dir)) return false;
  return [dir, path.join(dir, '.venv'), path.join(dir, 'venv'), path.join(dir, 'env')].some((r) => {
    let libs = false;
    if (isWin) libs = fs.existsSync(path.join(r, 'Lib', 'site-packages', pkg));
    else {
      try {
        libs = fs.readdirSync(path.join(r, 'lib')).some((d) => /^python3\.\d+$/.test(d) && fs.existsSync(path.join(r, 'lib', d, 'site-packages', pkg)));
      } catch {}
    }
    if (!libs) return false;
    // The libraries are no use without the interpreter they were installed for: a venv whose base Python
    // was removed (another app moving its Python, say) cannot run.
    try {
      const home = /^home\s*=\s*(.+)$/m.exec(fs.readFileSync(path.join(r, 'pyvenv.cfg'), 'utf8'))?.[1]?.trim();
      return !home || fs.existsSync(path.join(home, isWin ? 'python.exe' : 'python3'));
    } catch {
      return true;
    }
  });
}

/** Where another app on this machine keeps the same voice. */
function sharedDir(name) {
  const home = path.join(os.homedir(), '.aikenh');
  try {
    const dir = JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8')).voices?.[name]?.dir;
    if (dir) return dir;
  } catch {}
  return path.join(home, 'tools', name);
}

function pythonLibraries(name, pkg, lock, env = {}) {
  const found = [process.env[`NODECINE_${name.toUpperCase()}_DIR`], tools(name), sharedDir(name)].find((d) => hasEnv(d, pkg));
  if (found) return say(`${name}: libraries already installed in ${found}`);
  if (spawnSync('uv', ['--version']).status !== 0) fail('uv is required: brew install uv');
  const venv = tools(name);
  say(`${name}: installing the libraries into ${venv} (a few minutes, once)…`);
  if (!fs.existsSync(path.join(venv, 'pyvenv.cfg'))) run('uv', ['venv', '--python', '3.12', venv]);
  const python = path.join(venv, isWin ? 'Scripts/python.exe' : 'bin/python');
  run('uv', ['pip', 'sync', '--python', python, '--require-hashes', lock], env);
}

/** Each pinned model file into the shared hub at its commit; files already there with the right hash are kept. */
async function models(name) {
  const { models } = JSON.parse(fs.readFileSync(providerFile(name, 'models.json'), 'utf8'));
  for (const m of models) {
    const snap = path.join(hub, `models--${m.repo.split('/').join('--')}`, 'snapshots', m.commit);
    for (const f of m.files) {
      const to = path.join(snap, f.path);
      if (fs.existsSync(to) && fs.statSync(to).size === f.size) continue;
      fs.mkdirSync(path.dirname(to), { recursive: true });
      say(`${name}: downloading ${m.repo}/${f.path} (${(f.size / 1e6).toFixed(0)} MB)`);
      await download(`https://huggingface.co/${m.repo}/resolve/${m.commit}/${f.path}`, to, f.sha256);
    }
    // refs/main belongs to whoever wrote it first; the workers load the pinned commit whatever it says.
    const ref = path.join(hub, `models--${m.repo.split('/').join('--')}`, 'refs', 'main');
    if (!fs.existsSync(ref)) {
      fs.mkdirSync(path.dirname(ref), { recursive: true });
      fs.writeFileSync(ref, m.commit);
    }
  }
  say(`${name}: model ready in ${hub}`);
}

const KOKORO = { model: 'kokoro-int8-multi-lang-v1_0', sha256: '72c347230107ef8a31098ec4d468a605244beef5f1ed00db97efa13518800653' };

async function kokoro() {
  const dirs = [process.env.NODECINE_KOKORO_DIR, path.join(tools('kokoro'), KOKORO.model), path.join(os.homedir(), '.aikenh', 'cache', 'kokoro', KOKORO.model)];
  const found = dirs.find((d) => d && fs.existsSync(path.join(d, 'model.int8.onnx')));
  if (found) return say(`kokoro: model already in ${found}`);
  const dir = tools('kokoro');
  fs.mkdirSync(dir, { recursive: true });
  const archive = path.join(dir, `${KOKORO.model}.tar.bz2`);
  say('kokoro: downloading the model (132 MB, once)…');
  await download(`https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/${KOKORO.model}.tar.bz2`, archive, KOKORO.sha256);
  run(isWin ? path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe') : 'tar', ['-xjf', archive, '-C', dir]);
  fs.rmSync(archive, { force: true });
  say(`kokoro: model ready in ${path.join(dir, KOKORO.model)}`);
}

if (voice === 'kokoro') await kokoro();
else if (voice === 'vieneu') {
  pythonLibraries('vieneu', 'vieneu', providerFile('vieneu', 'vieneu.txt'));
  await models('vieneu');
} else if (voice === 'omnivoice') {
  say('omnivoice: a large add-on (PyTorch and a 3.3 GB model, about 8 GB in all).');
  // Windows x64 with an NVIDIA card takes the CUDA library set; everything else (Apple silicon, CPU) the common one.
  const cuda = isWin && process.arch === 'x64' && spawnSync('nvidia-smi', ['-L']).status === 0;
  pythonLibraries('omnivoice', 'omnivoice', providerFile('omnivoice', cuda ? 'clone-cuda.txt' : 'clone.txt'), cuda ? { UV_INDEX_STRATEGY: 'unsafe-best-match' } : {});
  await models('omnivoice');
  say(`omnivoice: put voice samples in ${path.join(root, '.nodecine', 'voices')}: an audio file of 3–10 seconds and a .txt of the same name with its exact words.`);
} else fail('usage: node scripts/setup-voice.mjs <kokoro|vieneu|omnivoice>');
