import { describe, expect, it } from 'vitest';
import { keepWebGlobals } from '../web-globals';

/** What Hono's listener does, verbatim: a data-property definition of the two names on the global. */
const override = (value: unknown) => {
  Object.defineProperty(global, 'Request', { value });
  Object.defineProperty(global, 'Response', { value });
};

describe('keepWebGlobals', () => {
  it('drops a redefinition of Request and Response on the global while it runs, and only then', async () => {
    const Response0 = globalThis.Response;
    const Request0 = globalThis.Request;
    const define = Object.defineProperty;
    class Fake {}
    await keepWebGlobals(async () => {
      override(Fake);
      expect(globalThis.Response).toBe(Response0);
      expect(globalThis.Request).toBe(Request0);
      // A route's result still passes the check Next makes.
      expect(new Response0('x') instanceof Response).toBe(true);
    });
    expect(Object.defineProperty).toBe(define);
    // Outside, the global is nobody's business but the caller's — put it back after checking.
    override(Fake);
    expect(globalThis.Response).toBe(Fake);
    Object.defineProperty(global, 'Response', { value: Response0 });
    Object.defineProperty(global, 'Request', { value: Request0 });
  });

  it('touches nothing else: other keys on the global, and the two names on other objects', async () => {
    await keepWebGlobals(async () => {
      Object.defineProperty(globalThis, '__nodecineProbe', { value: 1, configurable: true });
      expect((globalThis as Record<string, unknown>).__nodecineProbe).toBe(1);
      delete (globalThis as Record<string, unknown>).__nodecineProbe;
      const o: Record<string, unknown> = {};
      Object.defineProperty(o, 'Response', { value: 2 });
      expect(o.Response).toBe(2);
    });
  });

  it('stays in place until the last of overlapping runs is done', async () => {
    const Response0 = globalThis.Response;
    const define = Object.defineProperty;
    let release!: () => void;
    const inner = keepWebGlobals(() => new Promise<void>((r) => { release = r; }));
    await keepWebGlobals(async () => undefined);
    // One run has finished, the other has not: still guarded.
    Object.defineProperty(global, 'Response', { value: class {} });
    expect(globalThis.Response).toBe(Response0);
    release();
    await inner;
    expect(Object.defineProperty).toBe(define);
  });

  it('restores when the run throws', async () => {
    const define = Object.defineProperty;
    await expect(keepWebGlobals(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(Object.defineProperty).toBe(define);
  });
});
