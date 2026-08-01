import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthMiddleware } from '../middleware/auth';
import { requireGamePermission } from '../middleware/gamePermissions';
import { EconomyController } from '../controllers/EconomyController';
import { FinancialController } from '../controllers/FinancialController';
import { ServicesController } from '../controllers/ServicesController';

const router = Router();

// Rate limiting for continuative-services routes (same style as locations.ts)
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
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:shops:list'),
  EconomyController.getGeneralStore
);

router.get('/economy/shops/:locationSlug',
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

// ========================================================================
// CONTINUATIVE SERVICES (servitù, comunicazioni, trasporti, sicurezza)
// ========================================================================

router.get('/economy/services',
  servicesReadLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:economy:services:read'),
  ServicesController.getServices
);

router.post('/economy/services/:serviceId/subscribe',
  servicesWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:economy:services:subscribe'),
  ServicesController.subscribeService
);

router.post('/economy/services/:serviceId/unsubscribe',
  servicesWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:economy:services:subscribe'),
  ServicesController.unsubscribeService
);

router.post('/economy/admin/force-service-renewal',
  servicesWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:admin:economy:services:renew'),
  ServicesController.adminForceRenewal
);

// ========================================================================
// FINANCIAL OPERATIONS (merged from finances.ts)
// ========================================================================

// Administrative endpoints (require admin permissions)
router.post('/economy/admin/reset-credit',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:admin:economy:reset-credit'),
  FinancialController.adminResetCredit
);

router.get('/economy/admin/status',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:admin:economy:status'),
  FinancialController.getSystemStatus
);

export default router;