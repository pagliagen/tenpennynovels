/**
 * Configurazione Jest — senza questo file le suite non partivano affatto:
 * jest caricava i .test.ts come CommonJS e falliva con "Must use import to
 * load ES Module", quindi `npm test` era verde-per-modo-di-dire ma non
 * eseguiva nulla.
 *
 * `next/jest` porta il transform SWC di Next (TS/JSX), il mapping degli alias
 * da tsconfig (`@/*`) e lo stub dei CSS Modules, senza doverli configurare a
 * mano.
 */
const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Alias `@/*` di tsconfig: next/jest non lo risolve nei test che montano
  // componenti reali (gli altri test usano solo import relativi).
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts']
};

module.exports = createJestConfig(config);
