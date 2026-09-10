import { afterEach } from 'vitest';

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
