import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AdminAuthMiddleware } from '@modules/admin/middleware/adminAuth';
import { requireViewPermission } from '@modules/admin/utils/permissions';
import { EditorialAiController } from '../controllers/EditorialAiController';

const router = express.Router();

// Le chiamate al modello sono lente: limite per IP più basso delle altre rotte admin.
router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
}));
router.use(AdminAuthMiddleware.requireAdminAccess);

// Suggerire una descrizione o dei tag serve a chi può modificare la location. Non salva nulla.
router.post(
  '/locations/:locationId/suggest-description',
  requireViewPermission('locations.update'),
  AdminAuthMiddleware.logAdminAction('suggest_location_description', 'editorial'),
  EditorialAiController.suggestDescription
);

router.post(
  '/locations/:locationId/suggest-tags',
  requireViewPermission('locations.update'),
  AdminAuthMiddleware.logAdminAction('suggest_location_tags', 'editorial'),
  EditorialAiController.suggestTags
);

// Le posizioni si chiedono anche creando la location (non ha ancora un id): il testo viene dal form.
router.post(
  '/suggest-positions',
  requireViewPermission('locations.update'),
  AdminAuthMiddleware.logAdminAction('suggest_location_positions', 'editorial'),
  EditorialAiController.suggestPositions
);

// La descrizione SEO si genera E si salva sul documento: serve il permesso di modificarlo.
router.post(
  '/documents/:documentId/generate-seo',
  AdminAuthMiddleware.requireGranularPermission('documents.update'),
  AdminAuthMiddleware.logAdminAction('generate_document_seo', 'editorial'),
  EditorialAiController.generateSeo
);

export default router;
