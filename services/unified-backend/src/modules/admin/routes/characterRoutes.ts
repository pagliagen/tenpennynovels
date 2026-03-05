import { Router } from 'express';
import { CharacterApprovalController } from '../controllers/CharacterApprovalController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';
import { autoLogOutcome } from '../middleware/auditMiddleware';

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

// IMPORTANT: Specific routes (/:characterId/xxx) must come BEFORE generic route (/:characterId)

// Approve character - specific route
router.post(
  '/:characterId/approve',
  requireViewPermission('characters.detail.approve'),
  AdminAuthMiddleware.logAdminAction('character.approve', 'character_management'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  CharacterApprovalController.submitCharacterReview
);

// Update review priority - specific route
router.patch(
  '/:characterId/priority',
  requireViewPermission('characters.detail.edit'),
  AdminAuthMiddleware.logAdminAction('character.update_priority', 'character_management'),
  autoLogOutcome,
  CharacterApprovalController.updateReviewPriority
);

// Get complete character details - generic route
router.get(
  '/:characterId',
  requireViewPermission('characters.detail.read'),
  AdminAuthMiddleware.logAdminAction('get_character_details', 'character_management'),
  CharacterApprovalController.getCharacterDetails
);

// Update character (including permissions) - generic route
router.patch(
  '/:characterId',
  requireViewPermission('characters.detail.edit'),
  AdminAuthMiddleware.logAdminAction('character.update', 'character_management'),
  autoLogOutcome,
  CharacterApprovalController.updateCharacter
);

// Delete character - generic route
router.delete(
  '/:characterId',
  requireViewPermission('characters.detail.delete'),
  AdminAuthMiddleware.logAdminAction('character.delete', 'character_management'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  CharacterApprovalController.deleteCharacter
);

// Bulk operations routes
router.post(
  '/bulk-approve',
  requireViewPermission('characters.detail.approve'),
  AdminAuthMiddleware.logAdminAction('character.bulk_approve', 'character_management'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  CharacterApprovalController.bulkApproveCharacters
);

router.post(
  '/bulk-reject',
  requireViewPermission('characters.detail.approve'),
  AdminAuthMiddleware.logAdminAction('character.bulk_reject', 'character_management'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  CharacterApprovalController.bulkRejectCharacters
);

router.post(
  '/bulk-delete',
  requireViewPermission('characters.detail.delete'),
  AdminAuthMiddleware.logAdminAction('character.bulk_delete', 'character_management'),
  autoLogOutcome,
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