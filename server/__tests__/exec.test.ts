import { describe, expect, it } from 'vitest';
import { exec } from '../exec';
import { withTimeout } from '@/capsules/providers/api-shared';

describe('subprocess cancellation', () => {
  it('rejects a signal that was aborted before the subprocess was requested', async () => {
    const controller = new AbortController();
    controller.abort(new Error('already stopped'));
    await expect(exec('this-program-must-never-run', { signal: controller.signal })).rejects.toThrow('already stopped');
  });

  it('passes an already aborted signal to a timed provider request', () => {
    const controller = new AbortController();
    controller.abort(new Error('already stopped'));
    const signal = withTimeout(controller.signal, 1000);
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe(controller.signal.reason);
  });
});
