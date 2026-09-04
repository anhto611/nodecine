import type { VideoIR } from '../types/ir';

/** In-session run history (EXECUTION_ENGINE §8.1). */
export interface RunRecord {
  seq: number;
  startedAt: number;
  durationMs: number;
  ir: VideoIR;
  /** Filled by the first Video Output that succeeds in this run. */
  thumbnailDataUrl?: string;
  engineId?: string;
  exports: { fileName: string; bytes: number; outputUrl: string }[];
}

export class RunHistory {
  private records: RunRecord[] = [];
  private seq = 0;

  constructor(private readonly capacity = 20) {}

  add(entry: Omit<RunRecord, 'seq' | 'exports'>): RunRecord {
    const record: RunRecord = { ...entry, seq: ++this.seq, exports: [] };
    this.records.unshift(record);
    if (this.records.length > this.capacity) this.records.length = this.capacity;
    return record;
  }

  latest(): RunRecord | undefined {
    return this.records[0];
  }

  all(): readonly RunRecord[] {
    return this.records;
  }

  find(seq: number): RunRecord | undefined {
    return this.records.find((r) => r.seq === seq);
  }
}
