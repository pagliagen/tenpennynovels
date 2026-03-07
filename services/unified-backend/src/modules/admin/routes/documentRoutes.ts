import { Router } from 'express';
import { DocumentManagementController } from '../controllers/DocumentManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { autoLogOutcome } from '../middleware/auditMiddleware';

const router = Router();

router.use(AdminAuthMiddleware.requireAdminAccess);

/**
 * Document Management Routes
 * Mounted on: /admin/documents
 */

// List documents tree (grouped by subtype)
router.get('/',
  AdminAuthMiddleware.requireGranularPermission('documents.read'),
  DocumentManagementController.getDocuments
);

// Create new document
router.post('/',
  AdminAuthMiddleware.requireGranularPermission('documents.create'),
  AdminAuthMiddleware.logAdminAction('document.create', 'document_management'),
  autoLogOutcome,
  DocumentManagementController.createDocument
);

// Get document with all children recursively (for hierarchical editing)
router.get('/:id/with-children',
  AdminAuthMiddleware.requireGranularPermission('documents.read'),
  DocumentManagementController.getDocumentWithChildren
);

// Get single document by ID (for editing)
router.get('/:id',
  AdminAuthMiddleware.requireGranularPermission('documents.read'),
  DocumentManagementController.getDocumentById
);

// Reorder document siblings
router.put('/reorder',
  AdminAuthMiddleware.requireGranularPermission('documents.update'),
  DocumentManagementController.reorderSiblings
);

// Update document
router.patch('/:id',
  AdminAuthMiddleware.requireGranularPermission('documents.update'),
  AdminAuthMiddleware.logAdminAction('document.update', 'document_management'),
  autoLogOutcome,
  DocumentManagementController.updateDocument
);

// Soft delete document
router.delete('/:id',
  AdminAuthMiddleware.requireGranularPermission('documents.delete'),
  AdminAuthMiddleware.logAdminAction('document.delete', 'document_management'),
  autoLogOutcome,
  DocumentManagementController.deleteDocument
);

// Toggle document visibility
router.patch('/:id/toggle-visibility',
  AdminAuthMiddleware.requireGranularPermission('documents.update'),
  AdminAuthMiddleware.logAdminAction('document.toggle_visibility', 'document_management'),
  autoLogOutcome,
  DocumentManagementController.toggleDocumentVisibility
);

// Toggle draft status
router.patch('/:id/toggle-draft',
  AdminAuthMiddleware.requireGranularPermission('documents.update'),
  AdminAuthMiddleware.logAdminAction('document.toggle_draft', 'document_management'),
  autoLogOutcome,
  DocumentManagementController.toggleDocumentDraft
);

// Manually regenerate chunks
router.post('/:id/regenerate-chunks',
  AdminAuthMiddleware.requireGranularPermission('documents.update'),
  AdminAuthMiddleware.logAdminAction('document.regenerate_chunks', 'document_management'),
  autoLogOutcome,
  DocumentManagementController.regenerateChunks
);

export { router as documentRoutes };
