import { Router } from 'express';
import { CDNController, upload } from '../controllers/CDNController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';

const router = Router();

router.use(AdminAuthMiddleware.requireAdminAccess);

router.post(
  '/upload',
  requireViewPermission('locations.update'),
  AdminAuthMiddleware.logAdminAction('cdn_upload', 'cdn'),
  upload.single('file'),
  CDNController.uploadImage
);

router.delete(
  '/:type/:entityId/:filename',
  requireViewPermission('locations.update'),
  AdminAuthMiddleware.logAdminAction('cdn_delete', 'cdn'),
  CDNController.deleteImage
);

router.get(
  '/:type/:entityId',
  requireViewPermission('locations.read'),
  CDNController.listImages
);

export { router as cdnRoutes };
export default router;
