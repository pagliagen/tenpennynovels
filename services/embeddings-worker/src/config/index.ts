/**
 * Centralized Configuration
 *
 * UNICO punto dove si legge process.env (pattern: unified-backend).
 * Tutti gli altri file importano da qui.
 */

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  env: {
    isProduction,
    isDevelopment: !isProduction,
  },

  // Database connections (SENSITIVE - keep in process.env)
  database: {
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/tenpennynovels',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Services (URLs non-sensitive)
  services: {
    qdrant: {
      url: process.env.QDRANT_URL || 'http://localhost:6333',
    },
    elasticsearch: {
      url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      indexPrefix: process.env.ELASTICSEARCH_INDEX_PREFIX || 'tenpennynovels',
    },
    python: {
      path: process.env.PYTHON_PATH || 'python3',
    },
    ollama: {
      url: process.env.OLLAMA_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'qwen3:8b',
    },
  },

  // HTTP server
  http: {
    port: parseInt(process.env.HTTP_PORT || '5001', 10),
    // SECURITY: nel deploy bare-metal (PM2 su VPS) il default va a 127.0.0.1 via
    // HTTP_BIND_HOST (vedi ecosystem.config.js). In Docker Compose l'isolamento è
    // già garantito dalla rete bridge privata: bindare a 127.0.0.1 lì impedisce
    // a qualunque altro container (incluso unified-backend) di raggiungere il
    // servizio, perché il bind riguarda solo il network namespace del container.
    host: process.env.HTTP_BIND_HOST || '0.0.0.0',
    logLevel: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
  },

  // Embedding service constants
  embeddings: {
    model: 'paraphrase-multilingual-MiniLM-L12-v2',
    dimensions: 384,
    cacheTTL: 3600, // 1 hour
  },

  // Moderation constants
  moderation: {
    model: 'hate-ita',
    configCacheTTL: 60000, // 1 minute
  },

  // Bull queue constants
  queue: {
    concurrency: 5,
    maxAttempts: 3,
    backoffDelay: 2000,
    keepCompleted: 100,
  },

  // Input validation limits (DoS prevention)
  validation: {
    maxTextLength: 50000, // 50KB
    maxSearchLimit: 100,
    minSearchScore: 0.0,
    maxSearchScore: 1.0,
    allowedDocumentTypes: ['ambientazione', 'regolamento', 'lore'] as const,
  },
};

export type DocumentType = typeof config.validation.allowedDocumentTypes[number];
