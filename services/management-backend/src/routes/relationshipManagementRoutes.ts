import { Router } from 'express';
import { RelationshipManagementController } from '../controllers/RelationshipManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';

const router = Router();

// All relationship management routes require admin access
router.use(AdminAuthMiddleware.requireAdminAccess);

// Relationship Types routes
router.get(
  '/types',
  requireViewPermission('relationships.access'),
  AdminAuthMiddleware.logAdminAction('view_relationship_types', 'relationship_management'),
  RelationshipManagementController.getRelationshipTypes
);

router.get(
  '/types/stats',
  requireViewPermission('relationships.access'),
  AdminAuthMiddleware.logAdminAction('view_relationship_type_stats', 'relationship_management'),
  RelationshipManagementController.getRelationshipTypeStats
);

router.post(
  '/types',
  requireViewPermission('relationships.manage'),
  AdminAuthMiddleware.logAdminAction('create_relationship_type', 'relationship_management'),
  RelationshipManagementController.createRelationshipType
);

router.put(
  '/types/:relationshipTypeId',
  requireViewPermission('relationships.manage'),
  AdminAuthMiddleware.logAdminAction('update_relationship_type', 'relationship_management'),
  RelationshipManagementController.updateRelationshipType
);

router.delete(
  '/types/:relationshipTypeId',
  requireViewPermission('relationships.manage'),
  AdminAuthMiddleware.logAdminAction('delete_relationship_type', 'relationship_management'),
  RelationshipManagementController.deleteRelationshipType
);

// Character Relationships routes
router.get(
  '/relationships',
  requireViewPermission('relationships.access'),
  AdminAuthMiddleware.logAdminAction('view_relationships', 'relationship_management'),
  RelationshipManagementController.getCharacterRelationships
);

router.post(
  '/relationships/:relationshipId/moderate',
  requireViewPermission('relationships.moderate'),
  AdminAuthMiddleware.logAdminAction('moderate_relationship', 'relationship_management'),
  RelationshipManagementController.moderateRelationship
);

// Relationship Proposals routes
router.get(
  '/proposals',
  requireViewPermission('relationships.access'),
  AdminAuthMiddleware.logAdminAction('view_relationship_proposals', 'relationship_management'),
  RelationshipManagementController.getRelationshipProposals
);

// Analytics routes
router.get(
  '/stats',
  requireViewPermission('relationships.access'),
  AdminAuthMiddleware.logAdminAction('view_relationship_stats', 'relationship_management'),
  RelationshipManagementController.getRelationshipStats
);

// Bulk Operations routes
router.post(
  '/types/bulk',
  requireViewPermission('relationships.manage'),
  AdminAuthMiddleware.logAdminAction('bulk_relationship_type_operations', 'relationship_management'),
  RelationshipManagementController.bulkOperations
);

export default router;