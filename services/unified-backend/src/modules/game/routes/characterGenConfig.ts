import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { CharacterCreationController } from '../controllers/CharacterCreationController';
import { createLogger } from '@shared/utils/logger';

const logger = createLogger({ serviceName: 'CharacterGenConfig' });
const router = Router();

const charGenConfigLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    result: false,
    error: 'Troppe richieste, riprova più tardi.',
    code: 'CHARGEN_CONFIG_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

/**
 * Middleware: Verify Character Generation Service Token
 * Used by character-gen service to fetch configuration
 */
function verifyCharGenToken(req: Request, res: Response, next: NextFunction) {
  const chargenSecret = process.env.CHARACTER_GEN_SECRET || 'default-chargen-secret-key-change-me';
  const token = req.headers['x-character-gen-secret'];

  if (token !== chargenSecret) {
    logger.warn('Invalid character-gen token', { ip: req.ip });
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing character-gen secret',
      code: 'INVALID_TOKEN'
    });
  }

  next();
}

/**
 * @route GET /character-gen/config
 * @desc Get complete character creation configuration (for character-gen service)
 * @access Protected with CHARACTER_GEN_SECRET header
 * @header X-Character-Gen-Secret - Service token
 */
router.get('/config',
  charGenConfigLimiter,
  verifyCharGenToken,
  CharacterCreationController.getConfig
);

export default router;
