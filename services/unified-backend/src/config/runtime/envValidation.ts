import { logger } from '@shared/utils/logger';

export interface EnvValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
}

const REQUIRED_VARS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'MONGODB_URI'
];

const RECOMMENDED_VARS = [
  'REDIS_URL',
  'AI_GATEWAY_WEBHOOK_SECRET'
];

export function validateEnvironment(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  for (const varName of RECOMMENDED_VARS) {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  }

  const isValid = missing.length === 0;

  if (!isValid) {
    logger.error('Variabili d\'ambiente obbligatorie mancanti:', { missing });
  }

  if (warnings.length > 0) {
    logger.warn('Variabili d\'ambiente raccomandate mancanti:', { warnings });
  }

  if (process.env.SKIP_AUTH_CHECK === 'true') {
    logger.warn('SKIP_AUTH_CHECK è attivo - NON usare in produzione');
  }

  return { isValid, missing, warnings };
}
