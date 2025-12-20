import { Router } from 'express';
import { DocumentManagementController } from '../controllers/DocumentManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

// Apply admin authentication middleware to all routes
router.use(AdminAuthMiddleware.requireAdminAccess);

// Document Groups Routes
router.get('/groups', 
  AdminAuthMiddleware.requireGranularPermission('documents.access'), 
  DocumentManagementController.getDocumentGroups
);

router.post('/groups', 
  AdminAuthMiddleware.requireGranularPermission('documents.detail.create'), 
  DocumentManagementController.createDocumentGroup
);

router.put('/groups/:id', 
  AdminAuthMiddleware.requireGranularPermission('documents.detail.update'), 
  DocumentManagementController.updateDocumentGroup
);

router.delete('/groups/:id', 
  AdminAuthMiddleware.requireGranularPermission('documents.detail.delete'), 
  DocumentManagementController.deleteDocumentGroup
);

router.put('/groups/:id/reorder', 
  AdminAuthMiddleware.requireGranularPermission('documents.detail.update'), 
  DocumentManagementController.reorderDocuments
);

// Document Routes
router.post('/', 
  AdminAuthMiddleware.requireGranularPermission('documents.detail.create'), 
  DocumentManagementController.createDocument
);

router.put('/:id', 
  AdminAuthMiddleware.requireGranularPermission('documents.detail.update'), 
  DocumentManagementController.updateDocument
);

router.delete('/:id', 
  AdminAuthMiddleware.requireGranularPermission('documents.detail.delete'), 
  DocumentManagementController.deleteDocument
);

// Global CSS routes
router.put('/css', 
  AdminAuthMiddleware.requireGranularPermission('documents.detail.update'), 
  DocumentManagementController.updateGlobalCSS
);

router.get('/css', 
  DocumentManagementController.getGlobalCSS
);

router.get('/css/data', 
  AdminAuthMiddleware.requireGranularPermission('documents.access'), 
  DocumentManagementController.getGlobalCSSData
);

export { router as documentRoutes };