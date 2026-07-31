import { Router } from 'express';
import { CharacterApprovalController } from '../controllers/CharacterApprovalController';
import { CharacterBanController } from '../controllers/CharacterBanController';
import { CharacterFinancesManagementController } from '../controllers/CharacterFinancesManagementController';
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
  (req, _res, next) => {
    req.body.action = 'approve';
    req.body.note = req.body.note || ''; // Default to empty string if not provided
    next();
  },
  CharacterApprovalController.submitCharacterReview
);

// Reject character - specific route (same handler, action forced to 'reject')
router.post(
  '/:characterId/reject',
  requireViewPermission('characters.detail.approve'),
  AdminAuthMiddleware.logAdminAction('character.reject', 'character_management'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  (req, _res, next) => { req.body.action = 'reject'; next(); },
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

// Change PNG referent - specific route
router.patch(
  '/:characterId/change-referent',
  requireViewPermission('characters.detail.edit'),
  AdminAuthMiddleware.logAdminAction('character.change_referent', 'character_management'),
  autoLogOutcome,
  CharacterApprovalController.changeReferent
);

router.post(
  '/:characterId/ban',
  requireViewPermission('users.ban'),
  AdminAuthMiddleware.logAdminAction('character.ban', 'character_management'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  CharacterBanController.banCharacter
);

router.delete(
  '/:characterId/ban',
  requireViewPermission('users.ban'),
  AdminAuthMiddleware.logAdminAction('character.unban', 'character_management'),
  autoLogOutcome,
  CharacterBanController.unbanCharacter
);

// Character finances - specific route (patrimonio, Valore di Credito, rendita settimanale)
router.get(
  '/:characterId/finances',
  requireViewPermission('characters.finances.access'),
  AdminAuthMiddleware.logAdminAction('character.finances.view', 'character_management'),
  CharacterFinancesManagementController.getFinances
);

router.patch(
  '/:characterId/finances',
  requireViewPermission('characters.finances.manage'),
  AdminAuthMiddleware.logAdminAction('character.finances.update', 'character_management'),
  autoLogOutcome,
  CharacterFinancesManagementController.updateFinances
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

// Face Claims Management - NEW
router.get(
  '/face-claims/duplicates',
  requireViewPermission('characters.detail.read'),
  AdminAuthMiddleware.logAdminAction('view_face_claims_duplicates', 'character_management'),
  CharacterApprovalController.getDuplicateFaceClaims
);

router.post(
  '/:id/approve-faceclaim',
  requireViewPermission('characters.detail.approve'),
  AdminAuthMiddleware.logAdminAction('approve_face_claim', 'character_management'),
  autoLogOutcome,
  CharacterApprovalController.approveFaceClaim
);

router.post(
  '/:id/reject-faceclaim',
  requireViewPermission('characters.detail.approve'),
  AdminAuthMiddleware.logAdminAction('reject_face_claim', 'character_management'),
  autoLogOutcome,
  CharacterApprovalController.rejectFaceClaim
);

export { router as characterRoutes };