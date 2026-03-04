/**
 * DocumentController
 *
 * Handles document retrieval via Route→Document resolution.
 * Public API for documents visualization (frontend apps/documents).
 * Supports semantic search and favorites management.
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Route from '@database/models/Route';
import Document from '@database/models/Document';
import { RouteService } from '../services/RouteService';
import { EmbeddingService } from '../services/EmbeddingService';
import { logger } from '@shared/utils/logger';
import { qdrant } from '../utils/qdrantClient';

const EMBEDDINGS_SERVICE_URL = process.env.EMBEDDINGS_SERVICE_URL || 'http://127.0.0.1:5001';

export class DocumentController {
  // ========== PUBLIC ROUTES ==========

  /**
   * GET /documents/:type/:path
   * Get document or category by route path
   *
   * Examples:
   *   /documents/ambientazione/folklore → document with children
   *   /documents/ambientazione/approfondimenti → category with sub-routes
   */
  static async getByPath(req: Request<{ type: string; path: string }>, res: Response): Promise<void> {
    const { type, path } = req.params;

    try {
      // Validate type
      if (!['ambientazione', 'approfondimenti', 'regolamento'].includes(type)) {
        res.status(400).json({
          success: false,
          error: 'Tipo non valido',
          code: 'INVALID_TYPE'
        });
        return;
      }

      // Use RouteService for routing
      const result = await RouteService.getByPath(
        type as 'ambientazione' | 'approfondimenti' | 'regolamento',
        path
      );

      // Handle redirects (302 Found)
      if (result.route.kind === 'redirect' && result.route.redirectTo) {
        // Check permissions for redirects too
        if (!result.route.isPublic && !req.user) {
          res.status(404).json({
            success: false,
            error: 'Risorsa non trovata',
            code: 'NOT_FOUND'
          });
          return;
        }

        res.redirect(302, result.route.redirectTo);
        return;
      }

      // Check permissions (unauthenticated users can only see public routes)
      if (!result.route.isPublic && !req.user) {
        res.status(404).json({
          success: false,
          error: 'Risorsa non trovata',
          code: 'NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        data: result
      });

    } catch (error: any) {
      // Route not found or disabled → Try vector search fallback
      if (error.message.includes('not found') || error.message.includes('disabled')) {
        try {
          const similarRoute = await RouteService.findSimilarRoute(type as any, path);

          if (similarRoute) {
            const redirectUrl = `/${similarRoute.type}/${similarRoute.path}`;
            res.redirect(302, redirectUrl);
            return;
          }
        } catch (fallbackError: any) {
          logger.error('Vector fallback failed:', fallbackError);
        }

        res.status(404).json({
          success: false,
          error: 'Risorsa non trovata',
          code: 'NOT_FOUND'
        });
        return;
      }

      logger.error('Error in getByPath:', error);
      res.status(500).json({
        success: false,
        error: 'Errore recupero documento',
        code: 'GET_DOCUMENT_ERROR'
      });
    }
  }

  /**
   * GET /documents/routes/list
   * List all enabled routes (for navigation/menu)
   *
   * Only returns TOP-LEVEL routes (no "/" in path)
   */
  static async listRoutes(req: Request, res: Response): Promise<void> {
    try {
      const { type } = req.query;

      const filter: any = { enabled: true };

      // Filter by type if provided
      if (type && ['ambientazione', 'approfondimenti', 'regolamento'].includes(type as string)) {
        filter.type = type;
      }

      // Public users see only isPublic=true routes
      if (!req.user) {
        filter.isPublic = true;
      }

      // Only return top-level routes (no "/" in path)
      filter.path = { $not: { $regex: '/' } };

      // Join Documents for title
      const routes = await Route.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: 'documents',
            localField: 'rootDocumentId',
            foreignField: '_id',
            as: 'document',
            pipeline: [
              { $match: { deleted: { $ne: true } } }
            ]
          }
        },
        {
          $unwind: {
            path: '$document',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            path: 1,
            type: 1,
            kind: 1,
            isPublic: 1,
            rootDocumentId: 1,
            hasDocument: { $ifNull: ['$document._id', null] },
            title: { $ifNull: ['$document.title', 'Untitled'] }
          }
        },
        {
          $match: {
            $or: [
              { kind: { $ne: 'document' } },
              { hasDocument: { $ne: null } }
            ]
          }
        },
        { $sort: { type: 1, path: 1 } }
      ]);

      res.json({
        success: true,
        data: routes
      });

    } catch (error: any) {
      logger.error('Error in listRoutes:', error);
      res.status(500).json({
        success: false,
        error: 'Errore recupero routes',
        code: 'LIST_ROUTES_ERROR'
      });
    }
  }

  /**
   * GET /documents/routes/list-hierarchical
   * List ALL routes with full hierarchical structure
   *
   * Returns routes grouped by type with parent/child relationships.
   */
  static async listRoutesHierarchical(req: Request, res: Response): Promise<void> {
    try {
      const filter: any = { enabled: true };

      // Public users see only isPublic=true routes
      if (!req.user) {
        filter.isPublic = true;
      }

      // Aggregate: Join Documents for order, title, description
      const routes = await Route.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: 'documents',
            localField: 'rootDocumentId',
            foreignField: '_id',
            as: 'document',
            pipeline: [
              { $match: { deleted: { $ne: true } } }
            ]
          }
        },
        {
          $unwind: {
            path: '$document',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            _id: 1,
            parentId: 1,
            path: 1,
            slug: 1,
            type: 1,
            kind: 1,
            isPublic: 1,
            rootDocumentId: 1,
            hasDocument: { $ifNull: ['$document._id', null] },
            title: { $ifNull: ['$document.title', 'Untitled Category'] },
            description: '$document.description',
            order: { $ifNull: ['$document.order', 0] }
          }
        },
        {
          $match: {
            $or: [
              { kind: { $ne: 'document' } },
              { hasDocument: { $ne: null } }
            ]
          }
        }
      ]);

      // Build hierarchical tree
      const hierarchicalRoutes = DocumentController.buildHierarchicalRouteTree(routes);

      // Group by type
      const grouped = {
        ambientazione: hierarchicalRoutes.filter(r => r.type === 'ambientazione'),
        approfondimenti: hierarchicalRoutes.filter(r => r.type === 'approfondimenti'),
        regolamento: hierarchicalRoutes.filter(r => r.type === 'regolamento')
      };

      res.json({
        success: true,
        routes: grouped
      });

    } catch (error: any) {
      logger.error('Error in listRoutesHierarchical:', error);
      res.status(500).json({
        success: false,
        error: 'Errore recupero routes gerarchiche',
        code: 'LIST_HIERARCHICAL_ROUTES_ERROR'
      });
    }
  }

  /**
   * Build hierarchical route tree from flat list
   * Recursively sorts children at each level
   */
  private static buildHierarchicalRouteTree(routes: any[]): any[] {
    const routeMap = new Map<string, any>();

    // Build lookup map with children array
    routes.forEach(route => {
      routeMap.set(route._id.toString(), {
        _id: route._id,
        parentId: route.parentId,
        path: route.path,
        slug: route.slug,
        type: route.type,
        kind: route.kind,
        title: route.title,
        description: route.description,
        displayCategory: route.displayCategory,
        isPublic: route.isPublic,
        order: route.order,
        children: []
      });
    });

    // Build parent-child relationships
    const rootRoutes: any[] = [];
    routes.forEach(route => {
      const routeWithChildren = routeMap.get(route._id.toString())!;

      if (route.parentId) {
        const parent = routeMap.get(route.parentId.toString());
        if (parent) {
          parent.children.push(routeWithChildren);
        } else {
          rootRoutes.push(routeWithChildren);
        }
      } else {
        rootRoutes.push(routeWithChildren);
      }
    });

    // Recursive sort by order at each level
    const sortChildren = (routes: any[]): any[] => {
      return routes
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(route => ({
          ...route,
          children: sortChildren(route.children)
        }));
    };

    return sortChildren(rootRoutes);
  }

  /**
   * GET /documents/semantic-search
   * Semantic search using Qdrant vector DB
   */
  static async semanticSearch(req: Request, res: Response): Promise<void> {
    try {
      const { q: query, type, limit = 5, minSimilarity = 0.5 } = req.query;

      // Validate query
      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Query richiesta',
          code: 'MISSING_QUERY'
        });
        return;
      }

      // Generate query embedding
      logger.info(`Generating embedding for query: "${query}"`);
      const embeddingRes = await fetch(`${EMBEDDINGS_SERVICE_URL}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: query }),
        signal: AbortSignal.timeout(30000)
      });

      if (!embeddingRes.ok) {
        throw new Error(`Embeddings service error: ${embeddingRes.status}`);
      }

      const embeddingData = await embeddingRes.json() as { success: boolean; embedding?: number[] };

      if (!embeddingData.success || !embeddingData.embedding) {
        throw new Error('Failed to generate query embedding');
      }

      const queryEmbedding = embeddingData.embedding;

      // Qdrant vector search
      logger.info(`Searching Qdrant with limit=${limit}, minSimilarity=${minSimilarity}`);

      const searchParams: any = {
        vector: queryEmbedding,
        limit: Number(limit),
        score_threshold: Number(minSimilarity)
      };

      // Optional type filter
      if (type && ['ambientazione', 'approfondimenti', 'regolamento'].includes(type as string)) {
        searchParams.filter = {
          must: [{ key: 'documentType', match: { value: type } }]
        };
      }

      const searchResults = await qdrant.search('document_chunks', searchParams);

      // Fetch chunk details from MongoDB
      const chunkIds = searchResults.map(r => r.payload?.chunkId as string).filter(Boolean);

      if (chunkIds.length === 0) {
        res.json({
          success: true,
          data: {
            results: [],
            totalResults: 0,
            query
          }
        });
        return;
      }

      const db = mongoose.connection.db;
      if (!db) {
        throw new Error('Database connection not available');
      }

      const chunks = await db.collection('documentchunks').find({
        _id: { $in: chunkIds.map(id => new mongoose.Types.ObjectId(id)) }
      }).toArray();

      // Fetch parent documents for each chunk
      const documentIds = chunks.map(c => c.documentId).filter(Boolean);
      const documents = await Document.find({
        _id: { $in: documentIds },
        deleted: { $ne: true }
      });

      // Fetch routes for matched documents
      const routes = await Route.find({
        rootDocumentId: { $in: documentIds },
        enabled: true
      });

      // Build maps
      const routeMap = new Map<string, any>();
      routes.forEach(route => {
        if (route.rootDocumentId) {
          routeMap.set(route.rootDocumentId.toString(), route);
        }
      });

      const documentMap = new Map<string, any>();
      documents.forEach(doc => {
        documentMap.set(doc._id.toString(), doc);
      });

      // Build results with similarity scores and anchor links
      const results = searchResults.map(result => {
        const chunk: any = chunks.find((c: any) => c._id.toString() === result.payload?.chunkId);
        if (!chunk) return null;

        const document = documentMap.get(chunk.documentId.toString());
        if (!document) return null;

        const route = routeMap.get(chunk.documentId.toString());
        if (!route) return null;

        // Check permissions
        if (!route.isPublic && !req.user) {
          return null;
        }

        // Determine anchor
        let anchorSlug = chunk.slug;
        if (chunk.headingLevel === 3 && chunk.parentSlug) {
          anchorSlug = chunk.parentSlug;
        }

        return {
          document: {
            _id: document._id,
            slug: document.slug,
            title: document.title,
            content: chunk.content.substring(0, 300) + (chunk.content.length > 300 ? '...' : ''),
            description: document.description,
            tags: document.tags || [],
            isDraft: document.isDraft || false
          },
          route: {
            path: route.path,
            type: route.type,
            title: route.title,
            anchor: `#${anchorSlug}`,
            fullPath: `/${route.type}/${route.path}#${anchorSlug}`
          },
          matchLevel: chunk.headingLevel,
          matchHeading: chunk.title,
          similarity: result.score,
          matchScore: (result.score * 100).toFixed(1) + '%'
        };
      }).filter(Boolean);

      res.json({
        success: true,
        data: {
          results,
          totalResults: results.length,
          query
        }
      });

    } catch (error: any) {
      logger.error('Error in semanticSearch:', error);
      res.status(500).json({
        success: false,
        error: 'Errore semantic search',
        code: 'SEARCH_ERROR'
      });
    }
  }

  /**
   * GET /documents/favorites
   * List user favorites (authenticated)
   */
  static async getFavorites(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Autenticazione richiesta',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const db = mongoose.connection.db;
      if (!db) {
        throw new Error('Database connection not available');
      }

      // Fetch favorites with route info
      const favorites = await db.collection('document_favorites').aggregate([
        { $match: { userId: req.user.userId } },
        {
          $lookup: {
            from: 'documents',
            localField: 'documentId',
            foreignField: '_id',
            as: 'document'
          }
        },
        { $unwind: '$document' },
        {
          $lookup: {
            from: 'routes',
            localField: 'document._id',
            foreignField: 'rootDocumentId',
            as: 'route'
          }
        },
        { $unwind: { path: '$route', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            id: '$_id',
            document: {
              _id: '$document._id',
              slug: '$document.slug',
              title: '$document.title',
              description: '$document.description',
              tags: '$document.tags',
              isDraft: '$document.isDraft'
            },
            route: {
              path: '$route.path',
              type: '$route.type',
              title: '$route.title'
            },
            addedAt: '$createdAt'
          }
        },
        { $sort: { addedAt: -1 } }
      ]).toArray();

      res.json({
        success: true,
        data: favorites
      });

    } catch (error: any) {
      logger.error('Error in getFavorites:', error);
      res.status(500).json({
        success: false,
        error: 'Errore recupero preferiti',
        code: 'GET_FAVORITES_ERROR'
      });
    }
  }

  /**
   * POST /documents/:type/:path/favorite
   * Toggle favorite (add/remove) (authenticated)
   */
  static async toggleFavorite(req: Request<{ type: string; path: string }>, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Autenticazione richiesta',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const { type, path } = req.params;

      // Find route and document
      const route = await Route.findOne({
        type,
        path,
        enabled: true,
        kind: 'document'
      });

      if (!route || !route.rootDocumentId) {
        res.status(404).json({
          success: false,
          error: 'Documento non trovato',
          code: 'NOT_FOUND'
        });
        return;
      }

      const document = await Document.findById(route.rootDocumentId);
      if (!document) {
        res.status(404).json({
          success: false,
          error: 'Documento non trovato',
          code: 'NOT_FOUND'
        });
        return;
      }

      const db = mongoose.connection.db;
      if (!db) {
        throw new Error('Database connection not available');
      }

      // Check if already favorited
      const existing = await db.collection('document_favorites').findOne({
        userId: req.user.userId,
        documentId: document._id
      });

      if (existing) {
        // Remove favorite
        await db.collection('document_favorites').deleteOne({ _id: existing._id });

        res.json({
          success: true,
          data: { favorited: false },
          message: 'Rimosso dai preferiti'
        });
      } else {
        // Add favorite
        await db.collection('document_favorites').insertOne({
          userId: req.user.userId,
          documentId: document._id,
          createdAt: new Date()
        });

        res.json({
          success: true,
          data: { favorited: true },
          message: 'Aggiunto ai preferiti'
        });
      }

    } catch (error: any) {
      logger.error('Error in toggleFavorite:', error);
      res.status(500).json({
        success: false,
        error: 'Errore toggle favorite',
        code: 'FAVORITE_ERROR'
      });
    }
  }
}
