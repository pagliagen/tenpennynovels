import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ItemManagementController } from '../controllers/ItemManagementController';
import { AdminAuthMiddleware } from '@modules/admin/middleware/adminAuth';
import { requireViewPermission } from '@modules/admin/utils/permissions';

const router = Router();

// CodeQL (js/missing-rate-limiting): limiter generico prima ancora
// dell'auth check, per proteggere anche quest'ultimo da un flood.
const routeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
});
router.use(routeLimiter);

// All item management routes require admin access
router.use(AdminAuthMiddleware.requireAdminAccess);

// Item listing and statistics routes
router.get(
  '/',
  requireViewPermission('items.access'),
  AdminAuthMiddleware.logAdminAction('view_items', 'item_management'),
  ItemManagementController.getItems
);

router.get(
  '/stats',
  requireViewPermission('items.access'),
  AdminAuthMiddleware.logAdminAction('view_item_stats', 'item_management'),
  ItemManagementController.getItemStats
);

// Item detail routes
router.get(
  '/:itemId',
  requireViewPermission('items.detail.view'),
  AdminAuthMiddleware.logAdminAction('view_item_details', 'item_management'),
  ItemManagementController.getItemDetails
);

// Item creation and modification routes
router.post(
  '/',
  requireViewPermission('items.detail.create'),
  AdminAuthMiddleware.logAdminAction('create_item', 'item_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ItemManagementController.createItem
);

router.put(
  '/:itemId',
  requireViewPermission('items.detail.update'),
  AdminAuthMiddleware.logAdminAction('update_item', 'item_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ItemManagementController.updateItem
);

router.delete(
  '/:itemId',
  requireViewPermission('items.detail.delete'),
  AdminAuthMiddleware.logAdminAction('delete_item', 'item_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ItemManagementController.deleteItem
);

// Bulk operations
router.post(
  '/bulk',
  requireViewPermission('items.detail.update'),
  AdminAuthMiddleware.logAdminAction('bulk_item_operation', 'item_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ItemManagementController.bulkItemOperations
);

export default router;
