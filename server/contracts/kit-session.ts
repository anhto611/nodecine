import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import os from 'node:os';
import { copyFile, cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { findBinary } from '@/server/exec';
import { assetPath, fileNameFromAssetUrl } from '@/server/paths';
import { createServerServices } from './services.server';
import { runNodeAction } from './actions';
import { projectFilePath } from '@/server/paths';
import { describeSample, type SampleProfile } from '@/contracts/agent/sample';
import { BLOCK_ROLES, readBlock } from '@/contracts/storyboard/blocks';
import { GUIDE_FILE } from '@/contracts/storyboard/guide';
import { COMPOSITION_ENTRY } from '@/contracts/types/composition';
import type { WorkflowModel } from '@/contracts/workflow-model';

/**
 * A kit built by a coding agent: the look and motion of a workflow's films, written as HyperFrames
 * files by the CLI the workflow's model runs on (Claude Code, Codex or Antigravity), working with its
 * own tools inside one folder and nowhere else.
 *
 * The workflow's agent edits a graph and cannot write a kit: a kit is dozens of files that have to be
 * written, run and looked at. So it hands this off — a request, the kit there is now, the sample video
 * if there is one — and gets back the files once NodeCine has checked them: the kit's contract
 * (`NODECINE-KIT.md`) and HyperFrames' lint. Problems found go back to the coding agent, twice at most.
 */

export const KIT_GUIDE = path.resolve(process.cwd(), 'server', 'contracts', 'kit', 'NODECINE-KIT.md');
export const kitsDir = (): string => path.resolve(process.cwd(), process.env.NODECINE_KITS_DIR ?? '.nodecine/kits');

const ROUND_TIMEOUT_MS = 45 * 60_000;
const REPAIR_ROUNDS = 2;
const TEXT = /\.(html?|m?js|css|md|json|svg|txt)$/i;
const SKIP = new Set(['NODECINE-KIT.md', 'SAMPLE.md', 'sample', 'node_modules', '.claude', '.agents', '.git', '.codex', 'renders', 'snapshots', 'snapshot', '.hyperframes']);
const MAX_KIT_BYTES = 3_000_000;
const LOG_LINES = 300;

export type { KitSession } from '@/contracts/agent/kit';
import type { KitSession } from '@/contracts/agent/kit';

interface Running {
  session: KitSession;
  child: ChildProcess | null;
  cancelled: boolean;
}

const sessions: Map<string, Running> = ((globalThis as { __nodecineKitSessions?: Map<string, Running> }).__nodecineKitSessions ??= new Map());

export function readKitSession(id: string): KitSession | null {
  return sessions.get(id)?.session ?? null;
}

export function cancelKitSession(id: string): boolean {
  const run = sessions.get(id);
  if (!run || run.session.state !== 'running') return false;
  run.cancelled = true;
  run.child?.kill('SIGTERM');
  return true;
}

const log = (run: Running, line: string) => {
  const clean = line.replace(/\s+/g, ' ').trim();
  if (!clean) return;
  run.session.log.push(clean.slice(0, 400));
  if (run.session.log.length > LOG_LINES) run.session.log.splice(0, run.session.log.length - LOG_LINES);
};

// ---------- what NodeCine checks ----------

/** The kit's contract, as `NODECINE-KIT.md` states it, plus HyperFrames' own lint errors. */
export async function kitProblems(files: Record<string, string>): Promise<string[]> {
  const problems: string[] = [];
  const entry = files[COMPOSITION_ENTRY];
  if (!entry) problems.push('index.html is missing');
  else {
    if (!entry.includes('<!-- nodecine:frames -->')) problems.push('index.html has no <!-- nodecine:frames --> inside its root');
    if (!/data-width\s*=\s*["']?\d+/.test(entry) || !/data-height\s*=\s*["']?\d+/.test(entry)) problems.push('the root of index.html needs data-width and data-height');
  }
  const blocks = Object.entries(files).filter(([p]) => /^compositions\/[a-z][a-z0-9-]{1,40}\.html$/.test(p));
  if (blocks.length < 3) problems.push(`only ${blocks.length} block(s) in compositions/: a film needs a hook, a few scenes and an outro`);
  const roles = new Set<string>();
  for (const [p, html] of blocks) {
    const name = p.slice('compositions/'.length, -'.html'.length);
    const role = /<html\b[^>]*\bdata-role\s*=\s*["']([a-z]+)["']/i.exec(html)?.[1];
    if (!role || !(BLOCK_ROLES as readonly string[]).includes(role)) problems.push(`${p}: <html data-role> must be one of ${BLOCK_ROLES.join(', ')}`);
    else roles.add(role);
    const info = readBlock(name, html);
    if (!info.description) problems.push(`${p}: <meta name="description"> is missing or empty`);
    if (!/getVariables\s*\(/.test(html) && info.variables.length) problems.push(`${p}: declares variables but never calls window.__hyperframes.getVariables() in its own script`);
  }
  if (!roles.has('hook')) problems.push('no block has data-role="hook"');
  if (!roles.has('outro')) problems.push('no block has data-role="outro"');
  if (!files[GUIDE_FILE]?.trim()) problems.push(`${GUIDE_FILE} is missing`);
  problems.push(
    ...(await runtimeProblems(
      files,
      blocks.map(([p]) => p),
    )),
  );
  try {
    const inspection = await createServerServices().invoke<{ findings: { severity: string; message: string; file?: string; code?: string }[] }>('composition/inspect', [files]);
    for (const f of inspection.findings.filter((x) => x.severity === 'error').slice(0, 20)) problems.push(`${f.file ?? 'lint'}: ${f.code ? `${f.code} ` : ''}${f.message}`);
  } catch (e) {
    problems.push(`lint could not run: ${e instanceof Error ? e.message : String(e)}`);
  }
  return problems;
}

/**
 * Each block played the way NodeCine's preview plays it, in a headless browser, for a few seconds: a
 * script that throws there throws in the Studio too, and lint cannot see it. The preview's bundle may
 * load a kit's own scripts before the ones it takes from a CDN, which is how a shared file that read
 * `window.THREE` as it loaded came out empty while the builder's own snapshot looked right.
 */
export async function runtimeProblems(files: Record<string, string>, blocks: string[]): Promise<string[]> {
  if (!blocks.length || !files[COMPOSITION_ENTRY]) return [];
  const problems: string[] = [];
  let browser: { newPage(): Promise<unknown>; close(): Promise<void> } | null = null;
  try {
    const puppeteer = (await import('puppeteer')).default;
    browser = await puppeteer.launch({ headless: true });
    for (const block of blocks) {
      let preview: { url: string };
      try {
        preview = (await runNodeAction('composition/preview-part', [{ files, media: {} }, block])) as { url: string };
      } catch (e) {
        problems.push(`${block}: NodeCine could not prepare it for preview: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      const m = /^\/api\/projects\/([^/]+)\/(.+)$/.exec(preview.url);
      if (!m) continue;
      const page = (await browser.newPage()) as import('puppeteer').Page;
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (msg) => {
        if (msg.type() === 'error' && /script error|TypeError|ReferenceError|SyntaxError/.test(msg.text())) errors.push(msg.text());
      });
      await page.goto(`file://${projectFilePath(m[1]!, m[2]!)}`, { waitUntil: 'load', timeout: 60_000 }).catch((e: Error) => errors.push(e.message));
      await new Promise((r) => setTimeout(r, 2500));
      await page.close();
      for (const err of [...new Set(errors)].slice(0, 2)) problems.push(`${block}: throws when NodeCine plays it: ${err.slice(0, 300)}`);
    }
  } catch (e) {
    problems.push(`the blocks could not be played to check them: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    await browser?.close().catch(() => undefined);
  }
  return problems;
}

/** The kit's files from the folder: text only, without what NodeCine put there for the agent. */
export async function collectKit(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  let bytes = 0;
  const walk = async (rel: string) => {
    for (const e of await readdir(path.join(dir, rel), { withFileTypes: true })) {
      if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(p);
      else if (e.isFile() && TEXT.test(e.name)) {
        const text = await readFile(path.join(dir, p), 'utf8');
        bytes += Buffer.byteLength(text);
        if (bytes > MAX_KIT_BYTES) throw new Error('the kit is larger than 3 MB of text');
        out[p] = text;
      }
    }
  };
  await walk('');
  return out;
}

// ---------- the coding agent ----------

interface Launch {
  cmd: string;
  args: string[];
  stdin?: string;
  /** How a line of its output reads in the log; null drops it. */
  read: (line: string) => string | null;
  /** The last thing it said, read from its output. */
  final: (out: string) => string;
}

/** A Claude Code event line, told as a line of the log. */
function claudeLine(line: string): string | null {
  try {
    const e = JSON.parse(line) as { type?: string; message?: { content?: { type: string; text?: string; name?: string; input?: Record<string, unknown> }[] }; result?: string };
    if (e.type === 'assistant')
      return (
        e.message?.content
          ?.map((c) => (c.type === 'text' ? c.text : c.type === 'tool_use' ? `${c.name} ${String(c.input?.file_path ?? c.input?.command ?? c.input?.pattern ?? '')}` : ''))
          .filter(Boolean)
          .join(' · ') || null
      );
    return null;
  } catch {
    return null;
  }
}

/**
 * Who builds the kit. Not always the workflow's model: building a kit takes a coding agent that can
 * read, write and run checks with nobody there to approve each step. Claude Code allows exactly the
 * tools named; Codex works in a writable sandbox. Antigravity, headless, is refused every read outside
 * its folder — and it always reads its own skills from ~/.gemini — so it stops before writing
 * anything; it is used only when neither of the others is on this machine.
 */
export async function kitBuilder(model: WorkflowModel): Promise<WorkflowModel> {
  if (model.provider === 'claude-code' || model.provider === 'codex') return model;
  if (await findBinary('claude', 'NODECINE_CLAUDE_BIN')) return { provider: 'claude-code', settings: {} };
  if (await findBinary('codex', 'NODECINE_CODEX_BIN')) return { provider: 'codex', settings: {} };
  return model;
}

async function launchFor(model: WorkflowModel, dir: string, prompt: string, stills: string[]): Promise<Launch> {
  const plain = (line: string) => line;
  const lastLines = (out: string) => out.trim().split('\n').slice(-30).join('\n');
  const chosen = typeof model.settings.model === 'string' && model.settings.model ? model.settings.model : undefined;
  if (model.provider === 'claude-code') {
    const bin = await findBinary('claude', 'NODECINE_CLAUDE_BIN');
    if (!bin) throw Object.assign(new Error('Claude Code CLI was not found'), { code: 'PROVIDER_NOT_INSTALLED' });
    return {
      cmd: bin,
      args: [
        '-p',
        '--output-format',
        'stream-json',
        '--verbose',
        '--max-turns',
        '150',
        // Writes inside this folder, reads anywhere (its skills live elsewhere), the HyperFrames checks;
        // anything else is refused without asking, since nobody is there to ask.
        '--permission-mode',
        'dontAsk',
        '--allowedTools',
        'Read',
        'Glob',
        'Grep',
        'LS',
        `Write(/${dir}/**)`,
        `Edit(/${dir}/**)`,
        `MultiEdit(/${dir}/**)`,
        'Bash(npx hyperframes lint:*)',
        'Bash(npx hyperframes check:*)',
        'Bash(npx hyperframes snapshot:*)',
        'Bash(npx --no-install hyperframes:*)',
        ...(chosen ? ['--model', chosen] : []),
      ],
      stdin: prompt,
      read: claudeLine,
      final: (out) => {
        const line = out
          .trim()
          .split('\n')
          .reverse()
          .find((l) => l.includes('"type":"result"'));
        try {
          return line ? String((JSON.parse(line) as { result?: string }).result ?? '') : '';
        } catch {
          return '';
        }
      },
    };
  }
  if (model.provider === 'codex') {
    const bin = await findBinary('codex', 'NODECINE_CODEX_BIN');
    if (!bin) throw Object.assign(new Error('Codex CLI was not found'), { code: 'PROVIDER_NOT_INSTALLED' });
    return {
      cmd: bin,
      args: ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'workspace-write', '-C', dir, ...(chosen ? ['-m', chosen] : []), ...stills.map((s) => `--image=${s}`), '-'],
      stdin: prompt,
      read: plain,
      final: lastLines,
    };
  }
  if (model.provider === 'agy') {
    const bin = await findBinary('agy', 'NODECINE_AGY_BIN');
    if (!bin) throw Object.assign(new Error('Antigravity CLI was not found'), { code: 'PROVIDER_NOT_INSTALLED' });
    return {
      cmd: bin,
      args: [
        '-p',
        prompt,
        '--output-format',
        'text',
        // Auto mode runs what it needs without a person to ask — headless, anything that asks is
        // refused and it stops — and the sandbox keeps its terminal inside its workspace: this folder.
        '--mode',
        'auto',
        '--sandbox',
        '--add-dir',
        dir,
        '--disable-slash-commands',
        ...(chosen ? ['--model', chosen] : []),
      ],
      read: plain,
      final: lastLines,
    };
  }
  throw Object.assign(new Error(`${model.provider} cannot build a kit: it has no tools to write files. Choose Claude Code, Codex or Antigravity as the workflow's model.`), {
    code: 'PROVIDER_PROCESS_FAILED',
  });
}

function runRound(run: Running, launch: Launch, dir: string): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(launch.cmd, launch.args, { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, detached: process.platform !== 'win32' });
    run.child = child;
    let out = '';
    let buffer = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), ROUND_TIMEOUT_MS);
    child.stdout!.setEncoding('utf8');
    child.stdout!.on('data', (chunk: string) => {
      out = (out + chunk).slice(-2_000_000);
      buffer += chunk;
      let at: number;
      while ((at = buffer.indexOf('\n')) >= 0) {
        const line = launch.read(buffer.slice(0, at));
        buffer = buffer.slice(at + 1);
        if (line) log(run, line);
      }
    });
    child.stderr!.setEncoding('utf8');
    child.stderr!.on('data', (chunk: string) => {
      for (const l of chunk.split('\n')) if (/error|denied|fail/i.test(l)) log(run, `! ${l}`);
    });
    child.stdin!.on('error', () => {});
    child.stdin!.end(launch.stdin ?? '');
    const done = (code: number | null) => {
      clearTimeout(timer);
      run.child = null;
      resolve({ code, out });
    };
    child.on('error', (e) => {
      log(run, `! ${e.message}`);
      done(-1);
    });
    child.on('close', done);
  });
}

export interface KitRequest {
  agentId: string;
  nodeId: string;
  /** What to build, as the workflow's agent put it. */
  request: string;
  /** The kit there is now. */
  files: Record<string, string>;
  sample?: SampleProfile;
  model: WorkflowModel;
}

/** Start building; the session runs on its own and is read with `readKitSession`. */
export async function startKitSession(req: KitRequest): Promise<KitSession> {
  const id = `kit-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const session: KitSession = { id, agentId: req.agentId, nodeId: req.nodeId, state: 'running', phase: 'build', round: 1, startedAt: new Date().toISOString(), log: [] };
  const run: Running = { session, child: null, cancelled: false };
  sessions.set(id, run);
  void build(run, req).catch((e) => {
    session.state = run.cancelled ? 'cancelled' : 'failed';
    session.error = e instanceof Error ? e.message : String(e);
    session.endedAt = new Date().toISOString();
  });
  return session;
}

async function build(run: Running, req: KitRequest): Promise<void> {
  const s = run.session;
  const dir = path.join(kitsDir(), s.id);
  await mkdir(dir, { recursive: true });
  for (const [rel, text] of Object.entries(req.files)) {
    if (rel.includes('..') || path.isAbsolute(rel)) continue;
    await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await writeFile(path.join(dir, rel), text, 'utf8');
  }
  await copyFile(KIT_GUIDE, path.join(dir, 'NODECINE-KIT.md'));
  // The HyperFrames skills go inside the folder, where each CLI looks for a project's own skills: an
  // agent working headless may not read outside its workspace, and nobody is there to allow it.
  const skills = await hyperframesSkills();
  for (const target of ['.claude/skills', '.agents/skills']) {
    for (const skill of skills) await cp(skill, path.join(dir, target, path.basename(skill)), { recursive: true }).catch(() => undefined);
  }
  if (skills.length) log(run, `${skills.length} HyperFrames skills copied in`);
  const stills: string[] = [];
  if (req.sample) {
    await mkdir(path.join(dir, 'sample'), { recursive: true });
    for (const [i, f] of req.sample.frames.entries()) {
      const to = path.join(dir, 'sample', `${String(i + 1).padStart(2, '0')}-${f.t}s.jpg`);
      await copyFile(assetPath(fileNameFromAssetUrl(f.url)), to).then(
        () => stills.push(to),
        () => undefined,
      );
    }
    await writeFile(
      path.join(dir, 'SAMPLE.md'),
      `# The sample video\n\n${describeSample(req.sample)}\n\nIts stills, one per segment, are in sample/ (named by the second they were taken at).\n`,
      'utf8',
    );
  }
  log(run, `kit folder ${dir}`);

  const first = `You are building a NodeCine kit in this folder. Read NODECINE-KIT.md first and follow it.

What to build: ${req.request}
${req.sample ? '\nThe person wants videos in the style of the sample described in SAMPLE.md. Look at every still in sample/ before you start: its layout, type, colours, captions and motion are what the kit should give every future video — not its topic or its words.\n' : ''}
The files already here are the workflow's current kit. Keep what fits the request and replace what does not; a new style means new blocks.
Work only inside this folder. When you are done, answer with a short summary of the blocks and anything you could not do.`;

  let prompt = first;
  const builder = await kitBuilder(req.model);
  if (builder.provider !== req.model.provider) log(run, `${req.model.provider} cannot build a kit unattended; ${builder.provider} builds it`);
  for (let round = 1; round <= 1 + REPAIR_ROUNDS; round++) {
    s.round = round;
    s.phase = round === 1 ? 'build' : 'repair';
    log(run, round === 1 ? `building with ${builder.provider}…` : `round ${round}: fixing what the check found`);
    const launch = await launchFor(builder, dir, prompt, round === 1 ? stills : []);
    let { code, out } = await runRound(run, launch, dir);
    // A CLI whose service would not start the conversation is having a moment: one more try, a little later.
    if (code !== 0 && !run.cancelled && /failed to start conversation|empty conversation id|overloaded|rate limit/i.test(s.log.slice(-3).join(' '))) {
      log(run, 'the model service did not start; trying again in 20 s');
      await new Promise((r) => setTimeout(r, 20_000));
      if (!run.cancelled) ({ code, out } = await runRound(run, launch, dir));
    }
    if (run.cancelled) {
      s.state = 'cancelled';
      s.endedAt = new Date().toISOString();
      return;
    }
    s.summary = launch.final(out).trim().slice(0, 4000) || s.summary;
    if (code !== 0) log(run, `! the agent stopped with exit ${code}`);
    s.phase = 'check';
    const files = await collectKit(dir);
    // An agent that changed nothing did not build anything, however sound the old kit is.
    if (round === 1 && sameKit(files, req.files)) {
      s.state = 'failed';
      s.error = `the coding agent changed nothing${
        s.log.filter((l) => l.startsWith('!')).slice(-1)[0]
          ? `: ${s.log
              .filter((l) => l.startsWith('!'))
              .slice(-1)[0]!
              .slice(2, 300)}`
          : ''
      }`;
      s.endedAt = new Date().toISOString();
      return;
    }
    const problems = await kitProblems(files);
    log(run, problems.length ? `check: ${problems.length} problem(s)` : 'check: the kit is sound');
    for (const p of problems.slice(0, 10)) log(run, `  - ${p}`);
    if (!problems.length || round === 1 + REPAIR_ROUNDS) {
      s.files = files;
      s.problems = problems;
      s.state = problems.length && !files[COMPOSITION_ENTRY] ? 'failed' : 'done';
      if (s.state === 'failed') s.error = 'the agent did not produce a usable kit';
      s.endedAt = new Date().toISOString();
      return;
    }
    prompt = `NodeCine checked the kit in this folder against NODECINE-KIT.md and HyperFrames' lint and found these problems. Fix every one, keep everything else, and answer with a short summary.\n\n${problems.map((p) => `- ${p}`).join('\n')}`;
  }
}

/** The HyperFrames skills installed for this person, wherever their CLIs keep them. */
async function hyperframesSkills(): Promise<string[]> {
  for (const root of [path.join(os.homedir(), '.agents', 'skills'), path.join(os.homedir(), '.claude', 'skills')]) {
    const names = (await readdir(root).catch(() => [] as string[])).filter((n) => /^hyperframes/.test(n));
    if (names.length) return names.map((n) => path.join(root, n));
  }
  return [];
}

const sameKit = (a: Record<string, string>, b: Record<string, string>): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
};

/** Old kit folders go after a week; the sessions in memory go with the process. */
export async function pruneKits(maxAgeMs = 7 * 24 * 3600_000): Promise<void> {
  const dir = kitsDir();
  for (const name of await readdir(dir).catch(() => [] as string[])) {
    const p = path.join(dir, name);
    const st = await stat(p).catch(() => null);
    if (st && Date.now() - st.mtimeMs > maxAgeMs) await rm(p, { recursive: true, force: true });
  }
}
