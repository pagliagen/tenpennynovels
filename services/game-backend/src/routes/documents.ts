// Document Routes - API endpoints for modular document system
// Handles both public document access and admin management

import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { conditionalBanCheck } from '../../../../packages/shared/src/middleware/conditionalBanCheck';
import {
  getDocuments,
  getDocument,
  searchDocuments,
  semanticSearchDocuments,
  getFavoriteDocuments,
  addDocumentToFavorites,
  removeDocumentFromFavorites,
  isDocumentFavorited
} from '../controllers/DocumentController';

const router = Router();

console.log('📚 [DOCUMENTS ROUTES] Initializing documents routes');

// Health check for documents service
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'documents-backend',
    timestamp: new Date().toISOString()
  });
});

// PUBLIC ROUTES - Document access (with optional authentication for private documents)

/**
 * GET /documents/init
 * Initialize documents app with authentication context
 * Used by the documents frontend to get auth context during app bootstrap
 */
router.get('/init',
  (req, res, next) => {
    console.log('📚 [DOCUMENTS INIT] Route accessed');
    next();
  },
  AuthMiddleware.optionalAuth,
  conditionalBanCheck('documents_banned'),
  (req, res) => {
    try {
      // Build auth context from the request
      const authContext = {
        isAuthenticated: !!req.user,
        user: req.user ? {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
          displayName: req.user.displayName,
          avatar: req.user.avatar,
          canAccessAdminPanel: req.user.canAccessAdminPanel,
          userRoles: req.user.userRoles || [],
          characterRoles: req.user.characterRoles || [],
        } : null,
        character: req.character ? {
          id: req.character.id,
          name: req.character.name,
          surname: req.character.surname,
          status: req.character.status,
          isApproved: req.character.status === 'APPROVED',
          gameplayRoles: req.character.gameplayRoles || [],
        } : null,
      };

      res.json({
        success: true,
        data: {
          authContext,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('Error in /documents/init:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  });

/**
 * GET /documents/list
 * Get list of all documents or filtered by type
 * Query params: type (ambientazione|regolamento)
 */
router.get('/list', AuthMiddleware.optionalAuth, conditionalBanCheck('documents_banned'), getDocuments);

/**
 * GET /documents/:type/:slug  
 * Get specific document with all its sections
 * Params: type (ambientazione|regolamento), slug
 */
router.get('/:type/:slug', AuthMiddleware.optionalAuth, conditionalBanCheck('documents_banned'), getDocument);

/**
 * GET /documents/search
 * Search within document content
 * Query params: q (required), type, page, limit
 */
router.get('/search', AuthMiddleware.optionalAuth, conditionalBanCheck('documents_banned'), searchDocuments);

/**
 * GET /documents/semantic-search
 * Semantic search using embeddings
 * Query params: q (required), type, limit, minSimilarity
 */
router.get('/semantic-search', AuthMiddleware.optionalAuth, conditionalBanCheck('documents_banned'), semanticSearchDocuments);

/**
 * GET /documents/favorites
 * Get user's favorite documents
 */
router.get('/favorites', AuthMiddleware.requireUserAuth, getFavoriteDocuments);

/**
 * POST /documents/:type/:slug/favorite
 * Add document to favorites
 */
router.post('/:type/:slug/favorite', AuthMiddleware.requireUserAuth, addDocumentToFavorites);

/**
 * DELETE /documents/:type/:slug/favorite
 * Remove document from favorites
 */
router.delete('/:type/:slug/favorite', AuthMiddleware.requireUserAuth, removeDocumentFromFavorites);

/**
 * GET /documents/:type/:slug/favorite
 * Check if document is favorited
 */
router.get('/:type/:slug/favorite', AuthMiddleware.requireUserAuth, isDocumentFavorited);

// NOTE: Admin document management endpoints have been moved to management-backend
// All document administration (create, update, delete, versions) should be handled there

export default router;