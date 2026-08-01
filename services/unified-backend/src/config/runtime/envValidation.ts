import { logger } from '@shared/utils/logger';
import { appConfig } from './appConfig';

export interface EnvValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
}

export function validateEnvironment(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!appConfig.jwt.secret) missing.push('JWT_SECRET');
  if (!appConfig.jwt.refreshSecret) missing.push('JWT_REFRESH_SECRET');
  if (!appConfig.db.mongodbUri) missing.push('MONGODB_URI');

  if (appConfig.isProduction) {
    if (!appConfig.smtp.user) missing.push('SMTP_USER');
    if (!appConfig.smtp.password) missing.push('SMTP_PASSWORD');
    if (!appConfig.services.aiGateway.url) missing.push('AI_GATEWAY_URL');
    if (!appConfig.services.aiGateway.clientId) missing.push('AI_GATEWAY_CLIENT_ID');
    if (!appConfig.services.aiGateway.apiKey) missing.push('AI_GATEWAY_API_KEY');
    if (!appConfig.services.aiGateway.hmacSecret) missing.push('AI_GATEWAY_HMAC_SECRET');
    if (!appConfig.services.aiGateway.webhookSecret) missing.push('AI_GATEWAY_WEBHOOK_SECRET');
    if (!appConfig.systemBotUserId) missing.push('SYSTEM_BOT_USER_ID');
  } else {
    if (appConfig.db.redisUrl === 'redis://localhost:6379') {
      warnings.push('REDIS_URL non impostato, uso default locale');
    }
  }

  const isValid = missing.length === 0;

  if (!isValid) {
    logger.error('Variabili d\'ambiente obbligatorie mancanti:', { missing });
  }

  if (warnings.length > 0) {
    logger.warn('Avvisi configurazione:', { warnings });
  }

  logger.info('Configurazione caricata:', {
    ambiente: appConfig.isProduction ? 'production' : 'development',
    porta: appConfig.port,
    bindHost: appConfig.bindHost,
    cookieDomain: appConfig.cookie.domain,
    emailMock: appConfig.features.emailMock,
  });

  return { isValid, missing, warnings };
}
