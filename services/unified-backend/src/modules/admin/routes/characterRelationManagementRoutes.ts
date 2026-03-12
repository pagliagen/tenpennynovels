import { Router } from 'express';
import { CharacterRelationManagementController } from '../controllers/CharacterRelationManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';

const router = Router();

// All character relation management routes require admin access
router.use(AdminAuthMiddleware.requireAdminAccess);

// Character Relation Types routes
router.get(
  '/types',
  requireViewPermission('relationships.access'),
  AdminAuthMiddleware.logAdminAction('view_character_relation_types', 'character_relation_management'),
  CharacterRelationManagementController.getCharacterRelationTypes
);

router.get(
  '/types/stats',
  requireViewPermission('relationships.access'),
  AdminAuthMiddleware.logAdminAction('view_character_relation_type_stats', 'character_relation_management'),
  CharacterRelationManagementController.getCharacterRelationTypeStats
);

router.post(
  '/types',
  requireViewPermission('relationships.manage'),
  AdminAuthMiddleware.logAdminAction('create_character_relation_type', 'character_relation_management'),
  CharacterRelationManagementController.createCharacterRelationType
);

router.put(
  '/types/:relationshipTypeId',
  requireViewPermission('relationships.manage'),
  AdminAuthMiddleware.logAdminAction('update_character_relation_type', 'character_relation_management'),
  CharacterRelationManagementController.updateCharacterRelationType
);

router.delete(
  '/types/:relationshipTypeId',
  requireViewPermission('relationships.manage'),
  AdminAuthMiddleware.logAdminAction('delete_character_relation_type', 'character_relation_management'),
  CharacterRelationManagementController.deleteCharacterRelationType
);

// Character Relations routes
router.get(
  '/relationships',
  requireViewPermission('relationships.access'),
  AdminAuthMiddleware.logAdminAction('view_character_relations', 'character_relation_management'),
  CharacterRelationManagementController.getCharacterRelations
);

router.post(
  '/relationships/:relationshipId/moderate',
  requireViewPermission('relationships.moderate'),
  AdminAuthMiddleware.logAdminAction('moderate_character_relation', 'character_relation_management'),
  CharacterRelationManagementController.moderateRelationship
);

// Character Relation Proposals routes
router.get(
  '/proposals',
  requireViewPermission('relationships.access'),
  AdminAuthMiddleware.logAdminAction('view_character_relation_proposals', 'character_relation_management'),
  CharacterRelationManagementController.getCharacterRelationProposals
);

// Analytics routes
router.get(
  '/stats',
  requireViewPermission('relationships.access'),
  AdminAuthMiddleware.logAdminAction('view_character_relation_stats', 'character_relation_management'),
  CharacterRelationManagementController.getRelationshipStats
);

// Bulk Operations routes
router.post(
  '/types/bulk',
  requireViewPermission('relationships.manage'),
  AdminAuthMiddleware.logAdminAction('bulk_character_relation_type_operations', 'character_relation_management'),
  CharacterRelationManagementController.bulkOperations
);

export default router;