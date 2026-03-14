/**
 * Configurazione centralizzata dell'API Gateway.
 *
 * UNICO punto dove si legge process.env.
 * Tutti gli altri file usano config.
 *
 * Il gateway non ha segreti: tutta la configurazione
 * è strutturale e derivata da isProduction.
 */

const isProduction = process.env.NODE_ENV === 'production';

const PROD_ORIGINS = [
  'https://tenpennynovels.com',
  'https://game.tenpennynovels.com',
  'https://documenti.tenpennynovels.com',
  'https://gestione.tenpennynovels.com',
];

const DEV_ORIGINS = [
  'http://localhost:4000',
  'http://localhost:4001',
  'http://localhost:4002',
  'http://localhost:4003',
  'http://localhost:4004',
  'http://localhost:4005',
];

export const config = {
  isProduction,
  port: 8000,
  logLevel: isProduction ? 'info' : 'debug',
  trustProxy: isProduction,

  backend: {
    url: isProduction
      ? 'http://127.0.0.1:3001'  // PM2 production - no env needed
      : (process.env.UNIFIED_BACKEND_URL || 'http://localhost:3001'),  // Docker dev or bare metal dev
  },

  cdn: {
    storagePath: '/cdn-storage',
    maxAge: isProduction ? '365d' : '0',
    immutable: isProduction,
    allowedOrigins: isProduction
      ? [
          'https://game.tenpennynovels.com',
          'https://gestione.tenpennynovels.com',
        ]
      : [
          'http://localhost:4001',
          'http://localhost:4004',
        ],
  },

  cors: {
    allowedOrigins: isProduction ? PROD_ORIGINS : DEV_ORIGINS,
  },

  rateLimit: {
    documents: {
      unauthenticated: { windowMs: 60_000, max: 30 },
      authenticated: { windowMs: 60_000, max: 120 },
    },
  },

  proxy: {
    defaultTimeout: 30_000,
    documentsTimeout: 120_000,
    socketTimeout: 60_000,
  },
};
