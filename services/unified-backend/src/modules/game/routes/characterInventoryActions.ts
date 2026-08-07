import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthMiddleware } from '../middleware/auth';
import { CharacterInventoryActionsController } from '../controllers/CharacterInventoryActionsController';

const router = Router();

// Rate limiters — same style as locations.ts/economy.ts (read vs write split).
const inventoryReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: {
    result: false,
    error: 'Troppe richieste, riprova più tardi.',
    code: 'INVENTORY_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

const inventoryWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    result: false,
    error: 'Troppe richieste, riprova più tardi.',
    code: 'INVENTORY_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

router.get(
  '/characters/:characterId/inventory',
  inventoryReadLimiter,
  AuthMiddleware.requireCharacterAuth,
  CharacterInventoryActionsController.listInventory
);
router.patch(
  '/characters/:characterId/inventory/:inventoryItemId/equip',
  inventoryWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  CharacterInventoryActionsController.setEquipped
);
router.delete(
  '/characters/:characterId/inventory/:inventoryItemId',
  inventoryWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  CharacterInventoryActionsController.discardItem
);
router.post(
  '/characters/:characterId/inventory/:inventoryItemId/transfer',
  inventoryWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  CharacterInventoryActionsController.transferItem
);

export default router;
