import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextCoreWebVitals = require('eslint-config-next/core-web-vitals');
const prettierConfig = require('eslint-config-prettier');

/**
 * Next.js 16 non espone più `next lint`. ESLint 9 richiede flat config.
 * Equivalente pratico al vecchio `next/core-web-vitals` + Prettier.
 */
/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts', '**/*.tsbuildinfo'],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      ...prettierConfig.rules,
      // eslint-plugin-react-hooks v7 (in eslint-config-next 16): molte segnalazioni su ref/useMemo
      // nel codice pre-esistente. Da riattivare e correggere a incrementi.
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/immutability': 'off',
      'react/no-unescaped-entities': 'warn',
      // Usare @/lib/logger, mai console.* direttamente (vedi 00-project-wide.md)
      'no-console': 'error',
    },
  },
  {
    files: ['src/lib/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
