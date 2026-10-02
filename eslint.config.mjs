import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

/**
 * Lint is here for the mistakes a type checker and a test cannot see: a hook called conditionally, a
 * variable left behind by an edit, an `any` that quietly switches type checking off. Style is
 * Prettier's job, and the rules that belong to this project — a capsule reaching into its neighbour,
 * core importing a node — are `npm run capsules:check`, which understands them far better than a plugin
 * would. Nothing here repeats either of those.
 */
export default [
  { ignores: ['.next/**', '.nodecine/**', 'node_modules/**', 'capsules/nodes/.generated/**', 'capsules/engines/.generated/**', 'capsules/providers/.generated/**', 'templates/.generated/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // The Studio shows the user's own media — a clip in a node body, a still from the asset store.
      // `next/image` optimises remote pictures for a public page; neither half of that applies here.
      '@next/next/no-img-element': 'off',
      // A leftover from an edit is worth seeing; an argument deliberately named and unused is not,
      // and neither is a `_`-prefixed one.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  // A config file is a config file: what it exports has no name to give.
  { files: ['*.mjs', '*.config.*'], rules: { 'import/no-anonymous-default-export': 'off' } },
  // Build scripts run in Node, outside any bundle, so the rules about what a bundle may contain
  // do not reach them.
  { files: ['scripts/**'], rules: { '@next/next/no-assign-module-variable': 'off' } },
];
