/**
 * Documents Routes
 *
 * Public routes for documents visualization (frontend apps/documents).
 * Uses direct Document lookup (no Route model).
 */

import { Router } from 'express';
import { DocumentController } from '../controllers/DocumentController';
import { AuthMiddleware } from '@modules/game/middleware/auth';
import { requireGamePermission } from '@modules/game/middleware/gamePermissions';

const router = Router();

// ========== PUBLIC ROUTES ==========

// List documents (for navigation/menu)
router.get('/routes/list', AuthMiddleware.optionalAuth, DocumentController.listRoutes);

// List documents grouped by subtype (hierarchical sidebar)
router.get('/routes/list-hierarchical', AuthMiddleware.optionalAuth, DocumentController.listRoutesHierarchical);

// AI availability status
router.get('/ai-status', DocumentController.aiStatus);

// Semantic search
router.get('/semantic-search', AuthMiddleware.optionalAuth, DocumentController.semanticSearch);
 
// Get document by type + nested path (e.g., /documents/ambientazione/introduzione/presentazione)
router.get('/:type/:category/:slug', AuthMiddleware.optionalAuth, (req, res) => {
  req.params.path = `${req.params.category}/${req.params.slug}`;
  return DocumentController.getByPath(req as any, res);
});

// Get document by type + single-level path
router.get('/:type/:path', AuthMiddleware.optionalAuth, DocumentController.getByPath);

// ========== AUTHENTICATED ROUTES ==========

// List user favorites
router.get('/favorites',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:documents:favorites:read'),
  DocumentController.getFavorites
);

// Toggle favorite (nested path)
router.post('/:type/:category/:slug/favorite',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:documents:favorites:toggle'),
  (req, res) => {
    req.params.path = `${req.params.category}/${req.params.slug}`;
    return DocumentController.toggleFavorite(req as any, res);
  }
);

// Toggle favorite (single-level path)
router.post('/:type/:path/favorite',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:documents:favorites:toggle'),
  DocumentController.toggleFavorite
);

export default router;
