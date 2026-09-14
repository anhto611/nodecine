import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Two kinds of test in one run. Most of the code is plain TypeScript and runs in Node, which is
 * fast and keeps a browser out of the way. Anything with `.tsx` in its name is a React component —
 * a node's body, a panel — and gets a DOM and a cleanup after every test.
 */
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['core/**/*.test.ts?(x)', 'contracts/**/*.test.ts?(x)', 'nodes/**/*.test.ts?(x)', 'templates/**/*.test.ts?(x)', 'lib/**/*.test.ts?(x)', 'providers/**/*.test.ts?(x)', 'server/**/*.test.ts?(x)', 'store/**/*.test.ts?(x)', 'components/**/*.test.ts?(x)'],
    environmentMatchGlobs: [['**/*.test.tsx', 'jsdom']],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
});
