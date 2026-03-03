import { Router } from 'express';
import { CharacterApprovalController } from '../controllers/CharacterApprovalController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';

const router = Router();

// All character routes require admin access
router.use(AdminAuthMiddleware.requireAdminAccess);

// Get all characters with pagination and filtering - require characters.read permission
router.get(
  '/', 
  requireViewPermission('characters.detail.read'), 
  AdminAuthMiddleware.logAdminAction('view_all_characters', 'character_management'), 
  CharacterApprovalController.getAllCharacters
);

// Character approval routes - require characters.read permission
router.get(
  '/pending',
  requireViewPermission('characters.detail.read'),
  AdminAuthMiddleware.logAdminAction('view_pending_characters', 'character_management'),
  CharacterApprovalController.getPendingCharacters
);

// Get pending characters for current admin to review
router.get(
  '/pending-for-me',
  requireViewPermission('characters.detail.read'),
  AdminAuthMiddleware.logAdminAction('view_my_pending_characters', 'character_management'),
  CharacterApprovalController.getPendingCharactersForMe
);

// Get complete character details with populated references
router.get(
  '/:characterId',
  requireViewPermission('characters.detail.read'),
  AdminAuthMiddleware.logAdminAction('get_character_details', 'character_management'),
  CharacterApprovalController.getCharacterDetails
);

router.post(
  '/:characterId/approve',
  requireViewPermission('characters.detail.approve'),
  AdminAuthMiddleware.logAdminAction('submit_character_approval', 'character_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  CharacterApprovalController.submitCharacterReview
);

router.patch(
  '/:characterId/priority',
  requireViewPermission('characters.detail.edit'),
  AdminAuthMiddleware.logAdminAction('update_review_priority', 'character_management'),
  CharacterApprovalController.updateReviewPriority
);

// Bulk operations routes
router.post(
  '/bulk-approve',
  requireViewPermission('characters.detail.approve'),
  AdminAuthMiddleware.logAdminAction('bulk_approve_characters', 'character_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  CharacterApprovalController.bulkApproveCharacters
);

router.post(
  '/bulk-reject',
  requireViewPermission('characters.detail.approve'),
  AdminAuthMiddleware.logAdminAction('bulk_reject_characters', 'character_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  CharacterApprovalController.bulkRejectCharacters
);

router.post(
  '/bulk-delete',
  requireViewPermission('characters.detail.delete'),
  AdminAuthMiddleware.logAdminAction('bulk_delete_characters', 'character_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  CharacterApprovalController.bulkDeleteCharacters
);

// Statistics routes - require characters.read permission
router.get(
  '/review-stats',
  requireViewPermission('characters.detail.read'),
  AdminAuthMiddleware.logAdminAction('view_review_statistics', 'character_management'),
  CharacterApprovalController.getReviewStats
);

export { router as characterRoutes };