import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { requireGamePermission } from '../middleware/gamePermissions';
import { EconomyController } from '../controllers/EconomyController';
import { FinancialController } from '../controllers/FinancialController';
import { ServicesController } from '../controllers/ServicesController';

const router = Router();

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
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:admin:shops:restock'),
  EconomyController.restockShop
);

// ========================================================================
// CONTINUATIVE SERVICES (servitù, comunicazioni, trasporti, sicurezza)
// ========================================================================

router.get('/economy/services',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:economy:services:read'),
  ServicesController.getServices
);

router.post('/economy/services/:serviceId/subscribe',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:economy:services:subscribe'),
  ServicesController.subscribeService
);

router.post('/economy/services/:serviceId/unsubscribe',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:economy:services:subscribe'),
  ServicesController.unsubscribeService
);

router.post('/economy/admin/force-service-renewal',
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