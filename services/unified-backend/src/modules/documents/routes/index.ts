/**
 * Documents Routes
 *
 * Public routes for documents visualization (frontend apps/documents).
 * Uses Route→Document resolution via RouteService.
 * Public routes: list routes, get by path, semantic search
 * Authenticated routes: favorites management
 */

import { Router } from 'express';
import { DocumentController } from '../controllers/DocumentController';
import { AuthMiddleware } from '@modules/game/middleware/auth';
import { requireGamePermission } from '@modules/game/middleware/gamePermissions';

const router = Router();

// ========== PUBLIC ROUTES ==========

/**
 * GET /documents/routes/list
 * List all enabled routes (for navigation/menu)
 * Query params: type (optional: ambientazione|approfondimenti|regolamento)
 * Auth: Optional - shows all routes if authenticated, only public if not
 */
router.get('/routes/list', AuthMiddleware.optionalAuth, DocumentController.listRoutes);

/**
 * GET /documents/routes/list-hierarchical
 * List ALL routes with full hierarchical structure
 * Returns routes grouped by type with parent/child relationships
 * Auth: Optional - shows all routes if authenticated, only public if not
 */
router.get('/routes/list-hierarchical', AuthMiddleware.optionalAuth, DocumentController.listRoutesHierarchical);

/**
 * GET /documents/semantic-search
 * Semantic search using Qdrant vector DB
 * Query params: q (required), type (optional), limit (default: 5), minSimilarity (default: 0.5)
 * Auth: Optional - searches all docs if authenticated, only public if not
 */
router.get('/semantic-search', AuthMiddleware.optionalAuth, DocumentController.semanticSearch);

/**
 * GET /documents/:type/:category/:slug
 * Get nested document (e.g., approfondimenti/medicina)
 * This MUST come before the single-level route to match correctly
 */
router.get('/:type/:category/:slug', AuthMiddleware.optionalAuth, (req, res) => {
  // Combine category/slug into path
  req.params.path = `${req.params.category}/${req.params.slug}`;
  return DocumentController.getByPath(req as any, res);
});

/**
 * GET /documents/:type/:path
 * Get document or category by route path (single-level)
 * Params: type (ambientazione|approfondimenti|regolamento), path (e.g., "folklore", "approfondimenti")
 * Auth: Optional - shows if public or if authenticated
 */
router.get('/:type/:path', AuthMiddleware.optionalAuth, DocumentController.getByPath);

// ========== AUTHENTICATED ROUTES ==========

/**
 * GET /documents/favorites
 * List user favorites
 * Requires: auth_token cookie + character context
 */
router.get('/favorites',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:documents:favorites:read'),
  DocumentController.getFavorites
);

/**
 * POST /documents/:type/:category/:slug/favorite
 * Toggle favorite (nested path)
 */
router.post('/:type/:category/:slug/favorite',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:documents:favorites:toggle'),
  (req, res) => {
    req.params.path = `${req.params.category}/${req.params.slug}`;
    return DocumentController.toggleFavorite(req as any, res);
  }
);

/**
 * POST /documents/:type/:path/favorite
 * Toggle favorite (single-level path)
 * Requires: auth_token cookie + character context
 */
router.post('/:type/:path/favorite',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:documents:favorites:toggle'),
  DocumentController.toggleFavorite
);

export default router;
