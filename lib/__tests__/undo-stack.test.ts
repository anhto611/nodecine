import { describe, expect, it } from 'vitest';
import { UndoStack } from '../undo-stack';

describe('UndoStack', () => {
  it('undoes and redoes in order, and a new change drops the redo branch', () => {
    const s = new UndoStack<string>();
    s.record('a'); s.record('b');
    expect(s.canUndo).toBe(true);
    expect(s.undo('c')).toBe('b');
    expect(s.undo('b')).toBe('a');
    expect(s.undo('a')).toBeNull();
    expect(s.redo('a')).toBe('b');
    s.record('b');
    expect(s.canRedo).toBe(false);
    expect(s.undo('x')).toBe('b');
  });

  it('coalesces a burst of edits with the same key into one step, but not across keys or after a pause', () => {
    const s = new UndoStack<string>(50, 800);
    s.record('v0', { coalesce: 'node-1', now: 0 });
    s.record('v1', { coalesce: 'node-1', now: 100 });
    s.record('v2', { coalesce: 'node-1', now: 200 });
    expect(s.undo('v3')).toBe('v0');
    s.record('w0', { coalesce: 'node-1', now: 1000 });
    s.record('w1', { coalesce: 'node-1', now: 2500 });
    expect(s.undo('w2')).toBe('w1');
    expect(s.undo('w1')).toBe('w0');
    s.record('x0', { coalesce: 'node-1', now: 5000 });
    s.record('x1', { coalesce: 'node-2', now: 5100 });
    expect(s.undo('x2')).toBe('x1');
  });

  it('keeps only the newest entries', () => {
    const s = new UndoStack<number>(3);
    for (let i = 0; i < 6; i++) s.record(i);
    expect(s.undo(9)).toBe(5);
    expect(s.undo(5)).toBe(4);
    expect(s.undo(4)).toBe(3);
    expect(s.undo(3)).toBeNull();
  });
});
