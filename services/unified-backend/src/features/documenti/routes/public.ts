/**
 * Documents Routes
 *
 * Public routes for documents visualization (frontend apps/documents).
 * Uses direct Document lookup (no Route model).
 */

import { Router, Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { DocumentController } from '../controllers/DocumentController';
import { AuthMiddleware } from '@modules/game/middleware/auth';
import { requireGamePermission } from '@modules/game/middleware/gamePermissions';

const router = Router();

// CodeQL non vede il rate limiting già applicato a monte da api-gateway per
// /documents (30/min non autenticati, 120/min autenticati — vedi
// docs/tecnica/backend/api-gateway.md), perché analizza solo questo
// service. Layer aggiuntivo qui per difesa in profondità e per il finding.
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
});

// ========== PUBLIC ROUTES ==========

// List documents (for navigation/menu)
router.get('/routes/list', publicLimiter, AuthMiddleware.optionalAuth, DocumentController.listRoutes);

// List documents grouped by subtype (hierarchical sidebar)
router.get('/routes/list-hierarchical', publicLimiter, AuthMiddleware.optionalAuth, DocumentController.listRoutesHierarchical);

// AI availability status
router.get('/ai-status', publicLimiter, DocumentController.aiStatus);

// Text search (full-text via MongoDB)
router.get('/search', publicLimiter, AuthMiddleware.optionalAuth, DocumentController.textSearch);

// Semantic search
router.get('/semantic-search', publicLimiter, AuthMiddleware.optionalAuth, DocumentController.semanticSearch);

// Get document by type + nested path (e.g., /documents/ambientazione/introduzione/presentazione)
router.get('/:type/:category/:slug', publicLimiter, AuthMiddleware.optionalAuth, (req, res) => {
  (req.params as Record<string, string>).path = `${req.params.category}/${req.params.slug}`;
  return DocumentController.getByPath(req as Request<{ type: string; path: string }>, res);
});

// Get document by type + single-level path
router.get('/:type/:path', publicLimiter, AuthMiddleware.optionalAuth, DocumentController.getByPath);

// ========== AUTHENTICATED ROUTES ==========

// List user favorites
router.get('/favorites',
  publicLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:documents:favorites:read'),
  DocumentController.getFavorites
);

// Toggle favorite (nested path)
router.post('/:type/:category/:slug/favorite',
  publicLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:documents:favorites:toggle'),
  (req, res) => {
    (req.params as Record<string, string>).path = `${req.params.category}/${req.params.slug}`;
    return DocumentController.toggleFavorite(req as Request<{ type: string; path: string }>, res);
  }
);

// Toggle favorite (single-level path)
router.post('/:type/:path/favorite',
  publicLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:documents:favorites:toggle'),
  DocumentController.toggleFavorite
);

export default router;
