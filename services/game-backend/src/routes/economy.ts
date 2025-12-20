import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { EconomyController } from '../controllers/EconomyController';

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

export default router;