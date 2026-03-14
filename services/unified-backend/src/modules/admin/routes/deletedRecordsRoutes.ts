/**
 * Deleted Records Routes
 *
 * Endpoints for managing soft deleted records (gestore-only)
 */

import { Router } from 'express';
import { DeletedRecordsController } from '../controllers/DeletedRecordsController';
import { requireViewPermission } from '../utils/permissions';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

router.use(AdminAuthMiddleware.requireAdminAccess);

/**
 * GET /admin/deleted-records
 *
 * Get list of deleted records
 * Permission: system.deleted_records (gestore-only)
 */
router.get(
  '/',
  requireViewPermission('system.deleted_records'),
  DeletedRecordsController.getDeletedRecords
);

/**
 * POST /admin/deleted-records/:id/restore
 *
 * Restore a soft deleted record
 * Permission: system.deleted_records (gestore-only)
 */
router.post(
  '/:id/restore',
  requireViewPermission('system.deleted_records'),
  DeletedRecordsController.restoreRecord
);

/**
 * DELETE /admin/deleted-records/:id
 *
 * Permanently delete a record (hard delete)
 * Enforces 30-day retention policy
 * Permission: system.deleted_records (gestore-only)
 */
router.delete(
  '/:id',
  requireViewPermission('system.deleted_records'),
  DeletedRecordsController.permanentDelete
);

/**
 * POST /admin/deleted-records/bulk-permanent-delete
 *
 * Bulk permanent delete with retention checks
 * Permission: system.deleted_records (gestore-only)
 */
router.post(
  '/bulk-permanent-delete',
  requireViewPermission('system.deleted_records'),
  DeletedRecordsController.bulkPermanentDelete
);

export default router;
