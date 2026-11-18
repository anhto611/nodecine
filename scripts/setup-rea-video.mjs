// Installs rea-video (Apache-2.0, https://github.com/JuneYaooo/rea-video), the analyzer a workflow's agent
// reads sample videos with: `node scripts/setup-rea-video.mjs`. Pinned to one commit; idempotent.
// Needs git and uv (brew install uv). About 320 MB, plus models it fetches on first use (about 250 MB).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO = 'https://github.com/JuneYaooo/rea-video';
const COMMIT = 'bb11b134807bf9bc46b5c5c700ec5b6e68716a91';
const dir = path.join(process.cwd(), '.nodecine', 'tools', 'rea-video');
const src = path.join(dir, 'src');
const venv = path.join(dir, 'venv');
const isWin = process.platform === 'win32';

const fail = (s) => {
  console.error(s);
  process.exit(1);
};
const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd });
  if (r.status !== 0) fail(`${cmd} ${args.join(' ')} failed`);
};
const out = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, encoding: 'utf8' }).stdout?.trim() ?? '';

if (spawnSync('git', ['--version']).status !== 0) fail('git is required');
if (spawnSync('uv', ['--version']).status !== 0) fail('uv is required: brew install uv');

fs.mkdirSync(dir, { recursive: true });
if (!fs.existsSync(path.join(src, '.git'))) run('git', ['clone', '--quiet', REPO, src]);
if (out('git', ['rev-parse', 'HEAD'], src) !== COMMIT) {
  run('git', ['fetch', '--quiet', 'origin'], src);
  run('git', ['checkout', '--quiet', COMMIT], src);
}
// Python 3.13: its OCR package uses the headless OpenCV the analyzer needs, with nothing to untangle.
if (!fs.existsSync(path.join(venv, 'pyvenv.cfg'))) run('uv', ['venv', '--quiet', '--python', '3.13', venv]);
const python = path.join(venv, isWin ? 'Scripts/python.exe' : 'bin/python');
run('uv', ['pip', 'install', '--quiet', '--python', python, '-e', `${src}[ocr,asr]`]);
const bin = path.join(venv, isWin ? 'Scripts/rea-video.exe' : 'bin/rea-video');
if (spawnSync(bin, ['--help']).status !== 0) fail('rea-video did not install');
console.log(`rea-video ${COMMIT.slice(0, 7)} ready at ${bin}`);
