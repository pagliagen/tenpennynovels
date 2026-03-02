import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { EconomyController } from '../controllers/EconomyController';
import { FinancialController } from '../controllers/FinancialController';

const router = Router();

// Economy routes (require character auth)
router.get('/economy/wallet', 
  AuthMiddleware.requireCharacterAuth, 
  EconomyController.getWallet
);

router.post('/economy/transfer',
  AuthMiddleware.requireCharacterAuth,
  EconomyController.transferMoney
);

router.get('/economy/general-store',
  AuthMiddleware.requireCharacterAuth,
  EconomyController.getGeneralStore
);

router.get('/economy/shops/:locationSlug',
  AuthMiddleware.requireCharacterAuth,
  EconomyController.getShopItems
);


router.post('/economy/purchase', 
  AuthMiddleware.requireCharacterAuth, 
  EconomyController.purchaseItem
);

router.post('/economy/shops/:shopId/restock',
  AuthMiddleware.requireCharacterAuth,
  EconomyController.restockShop
);

// ========================================================================
// FINANCIAL OPERATIONS (merged from finances.ts)
// ========================================================================

// Transaction history
router.get('/economy/transactions',
  AuthMiddleware.requireCharacterAuth,
  FinancialController.getTransactionHistory
);

// Administrative endpoints (require admin auth)
router.post('/economy/admin/grant',
  AuthMiddleware.requireCharacterAuth, // TODO: Change to requireAdminAuth when available
  FinancialController.adminMoneyGrant
);

router.post('/economy/admin/reset-credit',
  AuthMiddleware.requireCharacterAuth, // TODO: Change to requireAdminAuth when available
  FinancialController.adminResetCredit
);

router.get('/economy/admin/status',
  AuthMiddleware.requireCharacterAuth, // TODO: Change to requireAdminAuth when available
  FinancialController.getSystemStatus
);

export default router;