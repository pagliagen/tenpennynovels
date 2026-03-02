import { Router } from 'express';
import { DocumentManagementController } from '../controllers/DocumentManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

// Apply admin authentication middleware to all routes
router.use(AdminAuthMiddleware.requireAdminAccess);

/**
 * Route Management Routes (NEW ARCHITECTURE - SPLIT SEMANTICO)
 *
 * Gestisce Routes (navigation layer) separatamente da Documents (content layer)
 * Mounted on: /admin/routes
 */

// Create new route
router.post('/',
  AdminAuthMiddleware.requireGranularPermission('documents.create'),
  DocumentManagementController.createRoute
);

// List all routes with tree structure
router.get('/',
  AdminAuthMiddleware.requireGranularPermission('documents.read'),
  DocumentManagementController.getDocuments
);

// Toggle route enabled (hide/show)
router.patch('/:id/toggle-enabled',
  AdminAuthMiddleware.requireGranularPermission('documents.update'),
  DocumentManagementController.toggleRouteEnabled
);

// Delete route (soft delete)
router.delete('/:id',
  AdminAuthMiddleware.requireGranularPermission('documents.delete'),
  DocumentManagementController.deleteRoute
);

export { router as routeRoutes };
