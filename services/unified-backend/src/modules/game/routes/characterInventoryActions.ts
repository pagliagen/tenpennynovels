import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { CharacterInventoryActionsController } from '../controllers/CharacterInventoryActionsController';

const router = Router();

router.get(
  '/characters/:characterId/inventory',
  AuthMiddleware.requireCharacterAuth,
  CharacterInventoryActionsController.listInventory
);
router.patch(
  '/characters/:characterId/inventory/:inventoryItemId/equip',
  AuthMiddleware.requireCharacterAuth,
  CharacterInventoryActionsController.setEquipped
);
router.delete(
  '/characters/:characterId/inventory/:inventoryItemId',
  AuthMiddleware.requireCharacterAuth,
  CharacterInventoryActionsController.discardItem
);
router.post(
  '/characters/:characterId/inventory/:inventoryItemId/transfer',
  AuthMiddleware.requireCharacterAuth,
  CharacterInventoryActionsController.transferItem
);

export default router;
