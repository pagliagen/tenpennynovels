import { Router } from 'express';
import { DocumentManagementController } from '../controllers/DocumentManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

// Apply admin authentication middleware to all routes
router.use(AdminAuthMiddleware.requireAdminAccess);

/**
 * Document Management Routes (NEW ARCHITECTURE - SPLIT SEMANTICO)
 *
 * Gestisce Documents (content layer) separatamente da Routes (navigation layer)
 * Mounted on: /admin/documents
 */

// Create new document
router.post('/',
  AdminAuthMiddleware.requireGranularPermission('documents.create'),
  DocumentManagementController.createDocument
);

// Get document with all children recursively (for hierarchical editing)
// IMPORTANT: Must be BEFORE /:id (more specific route first!)
router.get('/:id/with-children',
  AdminAuthMiddleware.requireGranularPermission('documents.read'),
  DocumentManagementController.getDocumentWithChildren
);

// Get single document by ID (for editing)
router.get('/:id',
  AdminAuthMiddleware.requireGranularPermission('documents.read'),
  DocumentManagementController.getDocumentById
);

// Reorder document siblings (batch operation - MAIN METHOD)
// Body: { parentId: string | null, orderedIds: string[] }
router.put('/reorder',
  AdminAuthMiddleware.requireGranularPermission('documents.update'),
  DocumentManagementController.reorderSiblings
);

// Reorder single document (change order/parentId) - DEPRECATED
// Body: { id: string, order: number, parentId: string | null }
// @deprecated Use /reorder with orderedIds array instead
router.put('/reorder-single',
  AdminAuthMiddleware.requireGranularPermission('documents.update'),
  DocumentManagementController.reorderDocument
);

// Update document (title, contentDelta, isDraft, visible, order)
router.patch('/:id',
  AdminAuthMiddleware.requireGranularPermission('documents.update'),
  DocumentManagementController.updateDocument
);

// Soft delete document (set deleted: true)
router.delete('/:id',
  AdminAuthMiddleware.requireGranularPermission('documents.delete'),
  DocumentManagementController.deleteDocument
);

// Toggle document visibility
router.patch('/:id/toggle-visibility',
  AdminAuthMiddleware.requireGranularPermission('documents.update'),
  DocumentManagementController.toggleDocumentVisibility
);

// Toggle draft status
router.patch('/:id/toggle-draft',
  AdminAuthMiddleware.requireGranularPermission('documents.update'),
  DocumentManagementController.toggleDocumentDraft
);

// Manually regenerate chunks for a document (for recovery/debugging)
router.post('/:id/regenerate-chunks',
  AdminAuthMiddleware.requireGranularPermission('documents.update'),
  DocumentManagementController.regenerateChunks
);

export { router as documentRoutes };
