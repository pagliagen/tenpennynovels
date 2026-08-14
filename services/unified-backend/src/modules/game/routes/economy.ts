import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthMiddleware } from '../middleware/auth';
import { requireGamePermission } from '../middleware/gamePermissions';
import { EconomyController } from '../controllers/EconomyController';

const router = Router();

// Rate limiting for shop routes (same style as locations.ts)
// Copia propria: prima condivisa con le route continuative-services/financial,
// spostate in features/economia/routes/game.ts (Fase 6.3) — shop e servizi
// continuativi non condividono più lo stesso budget di rate-limit (stessi
// parametri, contatori indipendenti).
const servicesReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: {
    result: false,
    error: 'Troppe richieste, riprova più tardi.',
    code: 'ECONOMY_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

const servicesWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    result: false,
    error: 'Troppe richieste, riprova più tardi.',
    code: 'ECONOMY_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

// Economy routes (require character auth)
router.get('/economy/general-store',
  servicesReadLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:shops:list'),
  EconomyController.getGeneralStore
);

router.get('/economy/shops/:locationSlug',
  servicesReadLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:shops:read'),
  EconomyController.getShopItems
);

router.post('/economy/shops/:shopId/restock',
  servicesWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:admin:shops:restock'),
  EconomyController.restockShop
);

router.post('/economy/general-store/:itemId/purchase',
  servicesWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:shops:purchase'),
  EconomyController.purchaseItem
);

export default router;
