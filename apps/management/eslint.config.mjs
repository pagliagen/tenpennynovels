import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const nextCoreWebVitals = require('eslint-config-next/core-web-vitals');

/**
 * Next.js 16 non espone più `next lint`. ESLint 10 richiede flat config, ma
 * `eslint-config-next/core-web-vitals` include internamente una versione di
 * `eslint-plugin-react` che usa `context.getFilename()`, API rimossa in ESLint 10
 * (non solo deprecata) — per questo `eslint` resta pinnato a `^9.x` come in `apps/game`.
 */
/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts', '**/*.tsbuildinfo'],
  },
  ...nextCoreWebVitals,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-console': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    files: ['src/lib/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
