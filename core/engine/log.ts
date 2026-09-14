import type { LogLevel } from '../nodes/definition';

export interface LogEntry {
  ts: number;
  nodeId: string;
  level: LogLevel;
  code?: string;
  message: string;
}

/** In-memory ring buffer. */
export class LogBuffer {
  private entries: LogEntry[] = [];
  private listeners = new Set<(e: LogEntry) => void>();

  constructor(private readonly capacity = 2000) {}

  push(entry: LogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.capacity) this.entries.splice(0, this.entries.length - this.capacity);
    for (const l of this.listeners) l(entry);
  }

  all(): readonly LogEntry[] {
    return this.entries;
  }

  clear(): void {
    this.entries = [];
  }

  subscribe(listener: (e: LogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
