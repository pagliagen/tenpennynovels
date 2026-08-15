import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { DocumentManagementController } from '../controllers/DocumentManagementController';
import { AdminAuthMiddleware } from '@modules/admin/middleware/adminAuth';
import { autoLogOutcome } from '@modules/admin/middleware/auditMiddleware';

const router = Router();

// CodeQL (js/missing-rate-limiting): limiter generico prima ancora
// dell'auth check, per proteggere anche quest'ultimo da un flood.
const routeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
});
router.use(routeLimiter);

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

// SEO data list (all documents with title + description + aiGatewayEnabled flag)
router.get('/seo',
  AdminAuthMiddleware.requireGranularPermission('documents.read'),
  DocumentManagementController.getSeoDocuments
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

// Regenerate SEO description via AI gateway
router.post('/:id/regenerate-seo',
  AdminAuthMiddleware.requireGranularPermission('documents.update'),
  AdminAuthMiddleware.logAdminAction('document.regenerate_seo', 'document_management'),
  autoLogOutcome,
  DocumentManagementController.regenerateSeoDescription
);

export default router;
