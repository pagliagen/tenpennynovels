/**
 * Configurazione centralizzata dell'applicazione.
 *
 * UNICO punto dove si legge process.env.
 * Tutti gli altri file usano appConfig.
 */

import path from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

export const appConfig = {
  isProduction,
  isTest,
  port: 3001,
  bindHost: isProduction ? '127.0.0.1' : '0.0.0.0',
  logLevel: isProduction ? 'info' : 'debug',
  trustProxy: isProduction,

  jwt: {
    secret: process.env.JWT_SECRET || (isProduction ? undefined : 'dev-secret-key-change-in-production'),
    refreshSecret: process.env.JWT_REFRESH_SECRET || (isProduction ? undefined : 'dev-refresh-secret-change-in-production'),
  },

  db: {
    mongodbUri: process.env.MONGODB_URI || (isProduction ? undefined : 'mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin'),
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'strict' : 'lax') as 'strict' | 'lax',
    domain: isProduction ? '.tenpennynovels.com' : 'localhost',
    path: '/',
  },

  cors: {
    allowedOrigins: isProduction
      ? [
        'https://api.tenpennynovels.com',
        'https://tenpennynovels.com',
        'https://game.tenpennynovels.com',
        'https://documenti.tenpennynovels.com',
        'https://gestione.tenpennynovels.com',
      ]
      : [
        'http://localhost:8000',
        'http://127.0.0.1:8000',
        'http://localhost:4000',
        'http://localhost:4001',
        'http://localhost:4002',
        'http://localhost:4003',
      ],
  },

  urls: {
    landing: isProduction ? 'https://tenpennynovels.com' : 'http://localhost:4000',
    game: isProduction ? 'https://game.tenpennynovels.com' : 'http://localhost:4001',
    documents: isProduction ? 'https://documenti.tenpennynovels.com' : 'http://localhost:4002',
    management: isProduction ? 'https://gestione.tenpennynovels.com' : 'http://localhost:4003',
    api: isProduction
      ? 'https://api.tenpennynovels.com'
      : (process.env.API_CALLBACK_BASE_URL || 'http://localhost:8000'),
  },

  features: {
    presenceCleanup: true,
    sceneClosing: true,
    geolocation: isProduction,
    emailMock: !isProduction,
  },

  /**
   * A quale ambiente appartengono i bot creati e mostrati dal tab «Bot» (`local`, `production`...): un bot vive nel
   * database dell'ambiente dove è stato creato. Si ricava dall'ambiente di esecuzione e non dev'essere impostato a mano:
   * `APP_ENVIRONMENT` serve solo a distinguere altri ambienti (es. `staging`). Fail-closed: in produzione, anche senza
   * variabile, è `production` e non `local`.
   */
  botEnvironment: (process.env.APP_ENVIRONMENT || (isProduction ? 'production' : 'local')).toLowerCase(),

  services: {
    embeddingsUrl: process.env.EMBEDDINGS_SERVICE_URL || 'http://127.0.0.1:5001',
    // Servizio bot locale (bot-service/): senza secret l'endpoint interno
    // /internal/bot-chat risponde 404 (fail-closed, mai attivo in produzione per svista).
    botService: {
      secret: process.env.BOT_SERVICE_SECRET,
      systemUserId: process.env.SYSTEM_BOT_USER_ID || '000000000000000000000001',
    },
    documents: {
      // URL interno (stesso VPS, dietro Nginx solo in produzione): evita il
      // round-trip via internet per una chiamata service-to-service.
      internalUrl: isProduction ? 'http://127.0.0.1:4002' : 'http://localhost:4002',
      revalidateSecret: process.env.DOCUMENTS_REVALIDATE_SECRET || '',
    },
  },

  // Gateway dei servizi AI (ai-gateway/): oggi un tunnel ngrok verso la macchina di sviluppo, domani un
  // server AI dedicato. Con ENABLE_IA_EDITORIAL=true l'AI editoriale è attiva solo se il gateway risponde.
  ai: {
    gatewayUrl: process.env.AI_GATEWAY_URL,
    gatewaySecret: process.env.AI_GATEWAY_SECRET,
    // La sonda è pigra (mai da un timer): la cache sta fra le chiamate. Valori alti perché il tunnel ha una quota.
    probeOkTtlMs: Number(process.env.AI_GATEWAY_PROBE_OK_TTL_MS) || 60_000,
    probeFailTtlMs: Number(process.env.AI_GATEWAY_PROBE_FAIL_TTL_MS) || 10_000,
  },

  cdn: {
    storagePath: process.env.CDN_STORAGE_PATH || '/cdn-storage',
    baseUrl: isProduction ? 'https://cdn.tenpennynovels.com' : 'http://localhost:8000/cdn',
  },

  smtp: {
    host: isProduction ? 'mail.tenpennynovels.com' : 'smtp.gmail.com',
    port: isProduction ? 465 : 587,
    secure: isProduction,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD || process.env.SMTP_PASS,
    from: 'info@tenpennynovels.com',
  },

  admin: {
    notificationEmail: process.env.ADMIN_EMAIL || 'admin@tenpennynovels.com',
  },

  bcryptRounds: isProduction ? 12 : 4,

  /** Output dir for landing sitemap. Docker: SITEMAP_OUTPUT_DIR volume. Dev: monorepo apps/landing/public. */
  sitemapOutputDir:
    process.env.SITEMAP_OUTPUT_DIR ||
    path.join(__dirname, '../../../../../apps/landing/public'),

  /** Output dir for documents sitemap. Docker: DOCUMENTS_SITEMAP_OUTPUT_DIR volume. Dev: monorepo apps/documents/public. */
  documentsSitemapOutputDir:
    process.env.DOCUMENTS_SITEMAP_OUTPUT_DIR ||
    path.join(__dirname, '../../../../../apps/documents/public'),
};
