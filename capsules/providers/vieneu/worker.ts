import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';

/**
 * The VieNeu model, kept loaded in a Python process of its own (worker.py), asked a line of JSON at a
 * time and answering in kind. Loading takes seconds; keeping it means only the first sentence of a
 * session waits for it. One process for the server, its requests answered in the order they were
 * asked; when it dies, the next request starts another.
 */

export interface WorkerRequest {
  cmd: 'voices' | 'say';
  text?: string;
  voice?: string;
  ref?: string;
  out?: string;
}

type Pending = { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void };

export class VieneuWorker {
  private child: ChildProcessWithoutNullStreams | null = null;
  private ready: Promise<void> | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private stderr = '';

  constructor(
    private readonly python: string,
    private readonly script: string,
    private readonly loadTimeoutMs = 600_000,
    /** What goes before the script: `-I` keeps a Python from reading the folder it runs in. */
    private readonly flags: string[] = ['-I'],
  ) {}

  /** Starts the process when there is none, and waits for the model to be loaded. */
  start(): Promise<void> {
    if (this.ready) return this.ready;
    const child = spawn(this.python, [...this.flags, this.script], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, HF_HUB_DISABLE_SYMLINKS_WARNING: '1', PYTHONIOENCODING: 'utf-8' },
      windowsHide: true,
    });
    this.child = child;
    this.stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      this.stderr = (this.stderr + chunk).slice(-4000);
    });
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`VieNeu did not load within ${Math.round(this.loadTimeoutMs / 1000)}s`));
        this.stop();
      }, this.loadTimeoutMs);
      const lines = createInterface({ input: child.stdout });
      lines.on('line', (line) => {
        let message: Record<string, unknown>;
        try {
          message = JSON.parse(line) as Record<string, unknown>;
        } catch {
          return;
        }
        if ('ready' in message) {
          clearTimeout(timer);
          if (message.ready) resolve();
          else reject(new Error(String(message.error ?? 'VieNeu could not load')));
          return;
        }
        const id = Number(message.id);
        const waiting = this.pending.get(id);
        if (!waiting) return;
        this.pending.delete(id);
        if (message.error) waiting.reject(new Error(String(message.error)));
        else waiting.resolve(message);
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
        this.fail(error);
      });
      child.on('exit', (code) => {
        clearTimeout(timer);
        const error = new Error(`VieNeu stopped (${code ?? 'killed'})${this.stderr.trim() ? `: ${this.stderr.trim().split('\n').slice(-3).join(' ')}` : ''}`);
        reject(error);
        this.fail(error);
      });
    });
    // A start that failed leaves nothing behind: the next request tries again.
    this.ready.catch(() => {
      this.ready = null;
    });
    return this.ready;
  }

  async ask(request: WorkerRequest, signal?: AbortSignal): Promise<Record<string, unknown>> {
    await this.start();
    const child = this.child;
    if (!child) throw new Error('VieNeu is not running');
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        // The sentence being said cannot be stopped; its answer is simply no longer waited for.
        this.pending.delete(id);
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      };
      if (signal?.aborted) return onAbort();
      signal?.addEventListener('abort', onAbort, { once: true });
      this.pending.set(id, {
        resolve: (v) => {
          signal?.removeEventListener('abort', onAbort);
          resolve(v);
        },
        reject: (e) => {
          signal?.removeEventListener('abort', onAbort);
          reject(e);
        },
      });
      child.stdin.write(`${JSON.stringify({ id, ...request })}\n`, 'utf8');
    });
  }

  stop(): void {
    this.child?.kill();
    this.child = null;
    this.ready = null;
  }

  private fail(error: Error): void {
    for (const waiting of this.pending.values()) waiting.reject(error);
    this.pending.clear();
    this.child = null;
    this.ready = null;
  }
}
