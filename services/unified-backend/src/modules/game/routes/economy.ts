import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { requireGamePermission } from '../middleware/gamePermissions';
import { EconomyController } from '../controllers/EconomyController';
import { FinancialController } from '../controllers/FinancialController';

const router = Router();

// Economy routes (require character auth)
router.get('/economy/wallet',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:economy:wallet:read'),
  EconomyController.getWallet
);

router.post('/economy/transfer',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:economy:transfer'),
  EconomyController.transferMoney
);

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

router.post('/economy/purchase',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:shops:purchase'),
  EconomyController.purchaseItem
);

router.post('/economy/shops/:shopId/restock',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:admin:shops:restock'),
  EconomyController.restockShop
);

// ========================================================================
// FINANCIAL OPERATIONS (merged from finances.ts)
// ========================================================================

// Transaction history
router.get('/economy/transactions',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:economy:transactions:read'),
  FinancialController.getTransactionHistory
);

// Administrative endpoints (require admin permissions)
router.post('/economy/admin/grant',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:admin:economy:grant'),
  FinancialController.adminMoneyGrant
);

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