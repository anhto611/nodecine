import { afterEach } from 'vitest';

/**
 * jsdom has no ResizeObserver, and anything that scales itself to the box it is given asks for one
 * — the scene preview does. A stub that never fires is enough: the component measures once on mount
 * and the tests do not resize anything.
 */
if (typeof globalThis.IntersectionObserver === 'undefined') {
  // Same reason as below: jsdom has none, and a lazily built preview asks for one. A stub that
  // never reports an intersection would hide every frame, so the component falls back to building
  // straight away when the API is missing; this keeps that path out of the way of the tests.
  globalThis.IntersectionObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): [] {
      return [];
    }
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [];
  } as unknown as typeof IntersectionObserver;
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}

/**
 * A rendered component left mounted leaks into the next test: its effects keep running and its
 * subscriptions to the store keep firing, so a test can pass or fail because of one before it.
 * Only the DOM runs need this, and `cleanup` is a no-op where there is no document.
 */
afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
