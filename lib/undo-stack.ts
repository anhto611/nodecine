/**
 * Undo history for one workflow tab: snapshots of the graph before each change, newest last.
 *
 * Pure and tiny so it can be tested without the store. Typing into a field produces one change per
 * keystroke; consecutive changes with the same coalesce key inside a short window keep only the
 * snapshot taken before the first of them, so one Ctrl+Z undoes the whole edit, not one character.
 */
export class UndoStack<T> {
  private past: T[] = [];
  private future: T[] = [];
  private lastKey: string | null = null;
  private lastAt = 0;

  constructor(private readonly capacity = 50, private readonly coalesceMs = 800) {}

  /** Call with the state *before* a change. */
  record(before: T, opts: { coalesce?: string; now?: number } = {}): void {
    const now = opts.now ?? Date.now();
    const same = opts.coalesce !== undefined && opts.coalesce === this.lastKey && now - this.lastAt < this.coalesceMs;
    this.lastKey = opts.coalesce ?? null;
    this.lastAt = now;
    this.future = [];
    if (same) return;
    this.past.push(before);
    if (this.past.length > this.capacity) this.past.shift();
  }

  /** Hands back the previous state, remembering `current` for redo; null when there is nothing to undo. */
  undo(current: T): T | null {
    const prev = this.past.pop();
    if (prev === undefined) return null;
    this.future.push(current);
    this.lastKey = null;
    return prev;
  }

  redo(current: T): T | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(current);
    this.lastKey = null;
    return next;
  }

  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }
}
