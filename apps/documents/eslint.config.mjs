import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextCoreWebVitals = require('eslint-config-next/core-web-vitals');
const prettierConfig = require('eslint-config-prettier');

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
  // I blocchi di `recommendedTypeChecked` senza `files` si applicherebbero anche a
  // questo stesso file .mjs: li scopiamo esplicitamente a ts/tsx.
  ...tseslint.configs.recommendedTypeChecked.map((c) => ({
    ...c,
    files: c.files ?? ['**/*.ts', '**/*.tsx'],
  })),
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      ...importPlugin.flatConfigs.recommended.rules,
      ...importPlugin.flatConfigs.typescript.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/no-unresolved': 'off',
      'import/named': 'off',
    },
  },
  {
    rules: {
      ...prettierConfig.rules,
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
