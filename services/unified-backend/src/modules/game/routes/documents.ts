/**
 * Documents Routes (NEW DUAL-TABLE ARCHITECTURE)
 *
 * Uses Route→Document resolution via DocumentService.
 * Public routes: list routes, get by path, semantic search
 * Authenticated routes: favorites management
 */

import { Router } from 'express';
import { DocumentController } from '../controllers/DocumentController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

// ========== PUBLIC ROUTES ==========

/**
 * GET /documents/routes/list
 * List all enabled routes (for navigation/menu)
 * Query params: type (optional: ambientazione|regolamento)
 * Auth: Optional - shows all routes if authenticated, only public if not
 */
router.get('/routes/list', AuthMiddleware.optionalAuth, DocumentController.listRoutes);

/**
 * GET /documents/routes/list-hierarchical
 * List ALL routes with full hierarchical structure (NEW)
 * Returns routes grouped by type with parent/child relationships
 * Auth: Optional - shows all routes if authenticated, only public if not
 *
 * Response: { success: true, routes: { ambientazione: [...], approfondimenti: [...], regolamento: [...] } }
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
 * Params: type (ambientazione|regolamento), path (e.g., "folklore", "approfondimenti")
 * Auth: Optional - shows if public or if authenticated
 *
 * Examples:
 *   GET /documents/ambientazione/folklore → document with children
 *   GET /documents/ambientazione/approfondimenti → category with sub-routes
 */
router.get('/:type/:path', AuthMiddleware.optionalAuth, DocumentController.getByPath);

// ========== AUTHENTICATED ROUTES ==========

/**
 * GET /documents/favorites
 * List user favorites
 * Requires: auth_token cookie
 */
router.get('/favorites',
  AuthMiddleware.requireUserAuth,
  DocumentController.getFavorites
);

/**
 * POST /documents/:type/:category/:slug/favorite
 * Toggle favorite (nested path)
 */
router.post('/:type/:category/:slug/favorite',
  AuthMiddleware.requireUserAuth,
  (req, res) => {
    req.params.path = `${req.params.category}/${req.params.slug}`;
    return DocumentController.toggleFavorite(req as any, res);
  }
);

/**
 * POST /documents/:type/:path/favorite
 * Toggle favorite (single-level path)
 * Requires: auth_token cookie
 * Params: type (ambientazione|regolamento), path (e.g., "folklore")
 */
router.post('/:type/:path/favorite',
  AuthMiddleware.requireUserAuth,
  DocumentController.toggleFavorite
);

// ========== ADMIN ROUTES (TODO - Future Implementation) ==========

// TODO: Admin routes for document and route management
// router.post('/admin/documents', AuthMiddleware.requireAdminAccess, DocumentController.createDocument);
// router.put('/admin/documents/:id', AuthMiddleware.requireAdminAccess, DocumentController.updateDocument);
// router.delete('/admin/documents/:id', AuthMiddleware.requireAdminAccess, DocumentController.deleteDocument);
// router.post('/admin/routes', AuthMiddleware.requireAdminAccess, DocumentController.createRoute);
// router.put('/admin/routes/:id', AuthMiddleware.requireAdminAccess, DocumentController.updateRoute);
// router.patch('/admin/routes/:id/toggle', AuthMiddleware.requireAdminAccess, DocumentController.toggleRoute);

export default router;
