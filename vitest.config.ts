import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: { include: ['core/**/*.test.ts', 'templates/**/*.test.ts', 'lib/**/*.test.ts', 'engines/**/*.test.ts', 'providers/**/*.test.ts', 'server/**/*.test.ts', 'components/**/*.test.ts'] },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
});
