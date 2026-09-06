import { spawn } from 'node:child_process';

/**
 * Subprocess helper enforcing CORE_CONTRACTS §9: argument arrays (never a shell string),
 * user content via stdin, timeouts, abort, capped output, secret scrubbing.
 */

export interface ExecOptions {
  args?: string[];
  stdin?: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Cap on captured stdout/stderr bytes (EXECUTION_ENGINE §8.2: 8 KB per call into logs). */
  maxOutput?: number;
}

export interface ExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** stdout reached `maxOutput` and was cut; a caller parsing it must not trust it. */
  truncated: boolean;
}

export class ExecError extends Error {
  constructor(message: string, public readonly result: ExecResult) {
    super(message);
    this.name = 'ExecError';
  }
}

const SECRET = /(sk-[a-zA-Z0-9_-]{8,}|ghp_[a-zA-Z0-9]{8,}|Bearer\s+[A-Za-z0-9._-]{8,})/g;

/** Strip anything that looks like a key or token before it reaches logs or the client (ARCHITECTURE §4). */
export function scrub(text: string): string {
  return text.replace(SECRET, '[redacted]');
}

export function exec(bin: string, opts: ExecOptions = {}): Promise<ExecResult> {
  const max = opts.maxOutput ?? 8 * 1024;
  return new Promise((resolve, reject) => {
    const child = spawn(bin, opts.args ?? [], {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = opts.timeoutMs ? setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, opts.timeoutMs) : undefined;
    const onAbort = () => child.kill('SIGKILL');
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    let truncated = false;
    child.stdout.on('data', (d: Buffer) => {
      const text = d.toString('utf8');
      if (stdout.length + text.length > max) truncated = true;
      if (stdout.length < max) stdout += text.slice(0, max - stdout.length);
    });
    child.stderr.on('data', (d: Buffer) => { if (stderr.length < max) stderr += d.toString('utf8').slice(0, max - stderr.length); });
    child.on('error', (err) => { cleanup(); reject(err); });
    child.on('close', (code) => {
      cleanup();
      resolve({ code, stdout: scrub(stdout), stderr: scrub(stderr), timedOut, truncated });
    });
    function cleanup() {
      if (timer) clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    }
    if (opts.stdin !== undefined) child.stdin.end(opts.stdin);
    else child.stdin.end();
  });
}

/** Locate a binary: explicit override env var, then PATH via `which`. */
export async function findBinary(name: string, overrideEnv?: string): Promise<string | null> {
  const override = overrideEnv ? process.env[overrideEnv] : undefined;
  if (override) return override;
  const r = await exec('/usr/bin/which', { args: [name], timeoutMs: 3000 }).catch(() => null);
  if (!r || r.code !== 0) return null;
  const p = r.stdout.trim().split('\n')[0];
  return p || null;
}
