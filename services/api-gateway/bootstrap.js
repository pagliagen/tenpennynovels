/**
 * Bootstrap entry point for api-gateway.
 * Loads dotenv BEFORE any TypeScript modules are required,
 * so process.env is fully populated when config.ts is evaluated.
 */
const path = require('path');
const dotenv = require('dotenv');

// 1. Root .env (shared across services)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 2. Root .env.<NODE_ENV> (e.g. .env.production)
const nodeEnv = process.env.NODE_ENV;
if (nodeEnv) {
  dotenv.config({ path: path.resolve(__dirname, `../../.env.${nodeEnv}`), override: true });
}

// 3. Local service .env (overrides root)
dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });

// 4. Local service .env.<NODE_ENV>
if (nodeEnv) {
  dotenv.config({ path: path.resolve(__dirname, `.env.${nodeEnv}`), override: true });
}

// Now load the compiled app — all modules will see the correct process.env
require('./dist/index.js');
