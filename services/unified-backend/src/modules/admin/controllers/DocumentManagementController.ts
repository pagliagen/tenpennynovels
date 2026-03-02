import { Request, Response } from 'express';
import { db } from '@database/models';
import Route from '@database/models/Route';
import Document from '@database/models/Document';
import { logger } from '../utils/logger';
import { errorResponse, getRequestId } from '../utils/apiResponse';
import { DocumentChunkService } from '../services/DocumentChunkService';
import jwt from 'jsonwebtoken';

// Access mongoose from the centralized connection
const mongoose = db.getMongoose();

/**
 * Document Management Controller (NEW ARCHITECTURE)
 *
 * Uses Route model (routing layer) + Document model (content layer)
 * Replaces the old DocumentModel + DocumentGroup system
 */
export class DocumentManagementController {

  /**
   * Get routes with full hierarchical tree (NEW ARCHITECTURE)
   * Returns nested route tree (parent/child) + document tree within each route
   * GET /admin/documents?type=ambientazione|regolamento
   */
  /**
   * Get documents tree with route metadata (SIMPLIFIED)
   * GET /admin/routes?type=ambientazione|regolamento
   *
   * Returns document hierarchy filtered by Document.type (not route descendants).
   */
  static async getDocuments(req: Request, res: Response): Promise<void> {
    try {
      const { type, search } = req.query;

      // Validate type
      if (!type || !['ambientazione', 'approfondimenti', 'regolamento'].includes(type as string)) {
        res.status(400).json(errorResponse(
          'type is required (ambientazione, approfondimenti, or regolamento)',
          'VALIDATION_ERROR',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // 1. Fetch documents for this type DIRECTLY (SIMPLIFIED)
      // Filter by Document.type instead of complex route descendant logic
      const allDocuments = await Document.find({
        type,
        deleted: { $ne: true }
      }).lean();

      // 2. Fetch routes for this type
      const routes = await Route.find({ type }).lean();
 
      // 3. Build lookup map: documentId → route metadata
      const docToRoute = new Map();
      routes.forEach((route: any) => {
        if (route.rootDocumentId) {
          const routeMeta = {
            _id: route._id.toString(),
            path: route.path,
            slug: route.slug,
            title: route.title,
            type: route.type,
            kind: route.kind,
            enabled: route.enabled,
            isPublic: route.isPublic
          };
          docToRoute.set(route.rootDocumentId.toString(), routeMeta);
        }
      });

      // 4. Recursive tree builder with route metadata
      const buildDocumentTree = (parentId: string | null, depth: number = 0): any[] => {
        if (depth > 10) return []; // Safety: prevent infinite recursion

        return allDocuments
          .filter((doc: any) => {
            const pid = doc.parentId ? doc.parentId.toString() : null;
            return pid === parentId;  // SIMPLIFIED: no validDocumentIds check
          })
          .sort((a: any, b: any) => a.order - b.order)
          .map((doc: any) => {
            const docId = doc._id.toString();
            const routeMetadata = docToRoute.get(docId) || null;

            // Apply search filter if provided
            if (search) {
              const searchLower = (search as string).toLowerCase();
              const matchesSearch =
                doc.title?.toLowerCase().includes(searchLower) ||
                doc.slug?.toLowerCase().includes(searchLower) ||
                routeMetadata?.path?.toLowerCase().includes(searchLower);
              if (!matchesSearch) return null; // Will be filtered out
            }

            return {
              _id: docId,
              slug: doc.slug,
              title: doc.title,
              isDraft: doc.isDraft,
              visible: doc.visible ?? true,
              tags: doc.tags || [],
              order: doc.order,
              parentId: doc.parentId ? doc.parentId.toString() : null,
              route: routeMetadata,  // ← Route metadata (null if no route)
              children: buildDocumentTree(docId, depth + 1)
            };
          })
          .filter((doc: any) => doc !== null); // Remove search mismatches
      };

      // 5. Return root documents (parentId = null)
      const data = buildDocumentTree(null);

      res.json({
        result: true,
        success: true,
        data,
        totalItems: data.length,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      logger.error('Error getting documents tree:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore nel recupero documenti',
        'GET_DOCUMENTS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Toggle route enabled status (hide/show)
   * PATCH /admin/documents/routes/:id/toggle-enabled
   */
  static async toggleRouteEnabled(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const route = await Route.findById(id);
      if (!route) {
        res.status(404).json(errorResponse(
          'Route non trovata',
          'ROUTE_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      route.enabled = !route.enabled;
      await route.save();

      logger.info(`Route ${route.path} ${route.enabled ? 'enabled' : 'disabled'} by admin`);

      res.json({
        result: true,
        success: true,
        data: {
          _id: route._id.toString(),
          path: route.path,
          enabled: route.enabled
        },
        message: `Route ${route.enabled ? 'abilitata' : 'nascosta'} con successo`,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      logger.error('Error toggling route enabled:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore nel toggle route',
        'TOGGLE_ROUTE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Delete route (soft delete by disabling)
   * DELETE /admin/documents/routes/:id
   */
  static async deleteRoute(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const route = await Route.findByIdAndDelete(id);
      if (!route) {
        res.status(404).json(errorResponse(
          'Route non trovata',
          'ROUTE_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      logger.warn(`Route ${route.path} deleted by admin`);

      res.json({
        result: true,
        success: true,
        message: 'Route eliminata con successo',
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      logger.error('Error deleting route:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore nell\'eliminazione route',
        'DELETE_ROUTE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Reorder document (update order and/or parentId)
   * PUT /admin/documents/:id/reorder
   * Body: { order?: number, parentId?: string | null }
   */
  /**
   * Reorder route (update order and/or parentId in route hierarchy)
   * PUT /admin/documents/routes/:id/reorder
   * Body: { order: number, parentId: string | null }
   *
   * CRITICAL: Reorders ALL siblings to maintain sequential order (0, 1, 2, 3...)
   */
  static async reorderRoute(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { order: newOrder, parentId: newParentId } = req.body;

      const route = await Route.findById(id);
      if (!route) {
        res.status(404).json(errorResponse(
          'Route non trovata',
          'ROUTE_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Validate parent if specified
      if (newParentId) {
        const parent = await Route.findById(newParentId);
        if (!parent) {
          res.status(404).json(errorResponse(
            'Parent document non trovato',
            'PARENT_DOCUMENT_NOT_FOUND',
            undefined,
            404,
            getRequestId(req)
          ));
          return;
        }

        // Prevent circular reference
        if (newParentId === id) {
          res.status(400).json(errorResponse(
            'Una route non può essere parent di se stessa',
            'CIRCULAR_REFERENCE',
            undefined,
            400,
            getRequestId(req)
          ));
          return;
        }
      }

      const oldParentId = route.parentId?.toString() || null;
      const targetParentId = newParentId || null;

      // Validate newOrder bounds
      if (typeof newOrder !== 'number' || newOrder < 0) {
        res.status(400).json(errorResponse(
          'Order deve essere un numero >= 0',
          'INVALID_ORDER',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // CRITICAL: Fetch ALL siblings (same parentId as target)
      // Mongoose query: use $exists:false for null/undefined parentId
      const siblings = await Route.find({
        $and: [
          targetParentId
            ? { parentId: mongoose.Types.ObjectId.createFromHexString(targetParentId) }
            : { $or: [{ parentId: null }, { parentId: { $exists: false } }] },
          { _id: { $ne: route._id } } // Exclude the route being moved
        ]
      }).sort({ order: 1 });

      // Build new siblings array with route inserted at newOrder position
      // CRITICAL: Order starts from 1 (not 0), clamp to valid range [1, siblings.length+1]
      const clampedOrder = Math.max(1, Math.min(newOrder, siblings.length + 1));
      const reorderedSiblings = [...siblings];
      reorderedSiblings.splice(clampedOrder - 1, 0, route as any); // -1 because array is 0-indexed

      // Bulk update: assign sequential order to ALL siblings (starting from 1, not 0)
      const bulkOps = reorderedSiblings.map((sibling, index) => ({
        updateOne: {
          filter: { _id: sibling._id },
          update: {
            $set: {
              order: index + 1, // Start from 1, not 0
              ...(sibling._id.toString() === id && targetParentId !== oldParentId
                ? { parentId: targetParentId ? mongoose.Types.ObjectId.createFromHexString(targetParentId) : undefined }
                : {})
            }
          }
        }
      }));

      await Document.bulkWrite(bulkOps);

      // Reload route to get updated path (pre-save hooks won't trigger with bulkWrite)
      // Manually trigger path recalculation if parent changed
      if (targetParentId !== oldParentId) {
        const updatedRoute = await Route.findById(id);
        if (updatedRoute) {
          await updatedRoute.save(); // Triggers pre-save hook for path calculation
        }
      }

      const updatedRoute = await Route.findById(id);

      logger.info(`Route ${updatedRoute?.path} reordered: order=${clampedOrder}, parentId=${targetParentId}, siblings_updated=${bulkOps.length}`);

      res.json({
        result: true,
        success: true,
        data: {
          _id: updatedRoute!._id.toString(),
          path: updatedRoute!.path,
          slug: updatedRoute!.slug,
          order: clampedOrder,
          parentId: updatedRoute!.parentId?.toString() || null,
          siblings_updated: bulkOps.length
        },
        message: 'Route riordinata con successo',
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      logger.error('Error reordering route:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore nel riordinamento route',
        'REORDER_ROUTE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Reorder siblings (NEW SIMPLE APPROACH)
   * PUT /admin/documents/routes/reorder-siblings
   * Body: { parentId: string | null, orderedIds: string[] }
   *
   * Frontend passes FULL ordered array of siblings, backend assigns sequential order (1, 2, 3...)
   */
  static async reorderSiblings(req: Request, res: Response): Promise<void> {
    try {
      const { parentId, orderedIds } = req.body;

      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        res.status(400).json(errorResponse(
          'orderedIds deve essere un array non vuoto',
          'INVALID_ORDERED_IDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate parent if specified
      if (parentId) {
        const parent = await Document.findById(parentId);
        if (!parent) {
          res.status(404).json(errorResponse(
            'Parent document non trovato',
            'PARENT_DOCUMENT_NOT_FOUND',
            undefined,
            404,
            getRequestId(req)
          ));
          return;
        }
      }

      // Validate all IDs exist
      const documents = await Document.find({ _id: { $in: orderedIds } });
      if (documents.length !== orderedIds.length) {
        res.status(404).json(errorResponse(
          'Alcuni documenti non sono stati trovati',
          'DOCUMENTS_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Bulk update: assign sequential order (1, 2, 3...) based on array position
      const bulkOps = orderedIds.map((docId, index) => ({
        updateOne: {
          filter: { _id: mongoose.Types.ObjectId.createFromHexString(docId) },
          update: {
            $set: {
              order: index + 1 // Start from 1, not 0
            }
          }
        }
      }));

      await Document.bulkWrite(bulkOps);

      logger.info(`Reordered ${orderedIds.length} siblings for parentId=${parentId || 'root'}`);

      res.json({
        result: true,
        success: true,
        data: {
          parentId: parentId || null,
          updated_count: orderedIds.length,
          order_range: [1, orderedIds.length]
        },
        message: `${orderedIds.length} routes riordinate con successo`,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      logger.error('Error reordering siblings:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore nel riordinamento siblings',
        'REORDER_SIBLINGS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update document (title, contentDelta, isDraft, visible, order)
   * PATCH /admin/documents/:id
   */
  static async updateDocument(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const updates = req.body; // { title?, contentDelta?, isDraft?, visible?, order? }

      const document = await Document.findByIdAndUpdate(
        id,
        { $set: { ...updates, lastUpdated: new Date() } },
        { new: true }
      );

      if (!document) {
        res.status(404).json(errorResponse(
          'Documento non trovato',
          'DOCUMENT_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      logger.info(`Document ${id} updated`, { updates });

      // NEW: Regenerate chunks if content changed
      if (updates.contentDelta) {
        try {
          // Find route to get document type (Document has no type field!)
          const route = await Route.findOne({ rootDocumentId: id });

          if (route) {
            // Extract user from JWT token (set by adminAuth middleware)
            const authToken = req.cookies?.auth_token;
            if (!authToken) {
              logger.warn('[ChunkSync] No auth token found for chunk regeneration');
            } else {
              try {
                const decoded = jwt.verify(authToken, process.env.JWT_SECRET!) as any;

                const chunkService = new DocumentChunkService();
                const result = await chunkService.regenerateChunksForDocument(
                  id,
                  updates.contentDelta,
                  route.type,
                  decoded.userId,
                  decoded.username || 'Unknown'
                );

                if (result.success) {
                  logger.info(`[ChunkSync] ✓ Chunks regenerated: ${result.chunksCreated} created, ${result.chunksDeactivated} deactivated (v${result.newVersion})`);
                } else {
                  logger.error(`[ChunkSync] ✗ Chunk regeneration failed: ${result.error}`);
                }
              } catch (jwtError: any) {
                logger.error('[ChunkSync] JWT decode failed:', jwtError);
              }
            }
          } else {
            logger.warn(`[ChunkSync] Document ${id} not linked to any route (orphaned) - skipping chunk regeneration`);
          }
        } catch (chunkError: any) {
          logger.error('[ChunkSync] Chunk regeneration failed (non-fatal):', chunkError);
          // Continue - don't fail the request
        }
      }

      res.json({
        result: true,
        success: true,
        data: document,
        message: 'Documento aggiornato con successo',
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      logger.error('Error updating document:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore aggiornamento documento',
        'UPDATE_DOCUMENT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Manually trigger chunk regeneration for a document
   * Useful for fixing stale chunks or re-syncing after errors
   * POST /admin/documents/:id/regenerate-chunks
   */
  static async regenerateChunks(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;

      // Fetch document
      const document = await Document.findById(id);
      if (!document) {
        res.status(404).json(errorResponse(
          'Documento non trovato',
          'DOCUMENT_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Find route to get document type
      const route = await Route.findOne({ rootDocumentId: id });
      if (!route) {
        res.status(400).json(errorResponse(
          'Documento non collegato a nessuna route',
          'NO_ROUTE_FOUND',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Extract user from JWT
      const authToken = req.cookies?.auth_token;
      if (!authToken) {
        res.status(401).json(errorResponse(
          'Token di autenticazione mancante',
          'NO_AUTH_TOKEN',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const decoded = jwt.verify(authToken, process.env.JWT_SECRET!) as any;

      // Regenerate chunks
      const chunkService = new DocumentChunkService();
      const result = await chunkService.regenerateChunksForDocument(
        id,
        document.contentDelta,
        route.type,
        decoded.userId,
        decoded.username || 'Unknown'
      );

      if (result.success) {
        logger.info(`[ManualSync] ✓ Document ${id}: ${result.chunksCreated} chunks created (v${result.newVersion})`);

        res.json({
          result: true,
          success: true,
          data: {
            chunksCreated: result.chunksCreated,
            chunksDeactivated: result.chunksDeactivated,
            newVersion: result.newVersion
          },
          message: 'Chunks rigenerati con successo',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json(errorResponse(
          result.error || 'Errore durante la rigenerazione dei chunks',
          'CHUNK_REGEN_ERROR',
          undefined,
          500,
          getRequestId(req)
        ));
      }

    } catch (error: any) {
      logger.error('[ManualSync] Error regenerating chunks:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore durante la rigenerazione dei chunks',
        'CHUNK_REGEN_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Soft delete document (set deleted: true)
   * Prevents deletion if document has children
   * DELETE /admin/documents/:id
   */
  static async deleteDocument(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if document has children
      const hasChildren = await Document.countDocuments({
        parentId: id,
        deleted: { $ne: true }
      });

      if (hasChildren > 0) {
        res.status(400).json(errorResponse(
          'Impossibile eliminare un documento con figli. Eliminare prima i documenti figli.',
          'DOCUMENT_HAS_CHILDREN',
          { childCount: hasChildren },
          400,
          getRequestId(req)
        ));
        return;
      }

      const document = await Document.findByIdAndUpdate(
        id,
        { $set: { deleted: true, lastUpdated: new Date() } },
        { new: true }
      );

      if (!document) {
        res.status(404).json(errorResponse(
          'Documento non trovato',
          'DOCUMENT_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      logger.info(`Document ${id} soft deleted`);

      res.json({
        result: true,
        success: true,
        message: 'Documento eliminato con successo',
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      logger.error('Error deleting document:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore eliminazione documento',
        'DELETE_DOCUMENT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Toggle document visibility
   * PATCH /admin/documents/:id/toggle-visibility
   */
  static async toggleDocumentVisibility(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const document = await Document.findById(id);

      if (!document) {
        res.status(404).json(errorResponse(
          'Documento non trovato',
          'DOCUMENT_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      document.visible = !document.visible;
      document.lastUpdated = new Date();
      await document.save();

      logger.info(`Document ${id} visibility toggled to ${document.visible}`);

      res.json({
        result: true,
        success: true,
        data: { visible: document.visible },
        message: `Documento ${document.visible ? 'reso visibile' : 'nascosto'} con successo`,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      logger.error('Error toggling document visibility:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore toggle visibilità documento',
        'TOGGLE_VISIBILITY_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Toggle document draft status
   * PATCH /admin/documents/:id/toggle-draft
   */
  static async toggleDocumentDraft(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const document = await Document.findById(id);

      if (!document) {
        res.status(404).json(errorResponse(
          'Documento non trovato',
          'DOCUMENT_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      document.isDraft = !document.isDraft;
      document.lastUpdated = new Date();
      await document.save();

      logger.info(`Document ${id} draft status toggled to ${document.isDraft}`);

      res.json({
        result: true,
        success: true,
        data: { isDraft: document.isDraft },
        message: `Documento ${document.isDraft ? 'segnato come bozza' : 'pubblicato'} con successo`,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      logger.error('Error toggling document draft:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore toggle draft documento',
        'TOGGLE_DRAFT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get single document by ID (for editing)
   */
  static async getDocumentById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const document = await Document.findById(id).lean();

      if (!document) {
        res.status(404).json(errorResponse(
          'Documento non trovato',
          'DOCUMENT_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Include metadata for optimistic locking
      res.json({
        result: true,
        success: true,
        data: {
          ...document,
          _id: document._id.toString(),
          parentId: document.parentId?.toString() || null,
          lastUpdated: document.lastUpdated
        },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      logger.error('Error fetching document:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore recupero documento',
        'GET_DOCUMENT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get document with all children recursively (for hierarchical editing)
   * @query depth - Max recursion depth (default: 10)
   */
  static async getDocumentWithChildren(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const depth = parseInt(req.query.depth as string) || 10;

      const rootDoc = await Document.findById(id).lean();

      if (!rootDoc) {
        res.status(404).json(errorResponse(
          'Documento non trovato',
          'DOCUMENT_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Recursive fetch children (up to depth limit)
      const fetchChildren = async (parentId: string, currentDepth: number): Promise<any[]> => {
        if (currentDepth >= depth) return [];

        const children = await Document.find({
          parentId,
          deleted: { $ne: true }
        })
        .sort({ order: 1 })
        .lean();

        // Recursively fetch grandchildren
        const childrenWithGrandchildren = await Promise.all(
          children.map(async (child) => ({
            ...child,
            _id: child._id.toString(),
            parentId: child.parentId?.toString() || null,
            children: await fetchChildren(child._id.toString(), currentDepth + 1)
          }))
        );

        return childrenWithGrandchildren;
      };

      const children = await fetchChildren(id, 0);
      const childCount = children.length;

      res.json({
        result: true,
        success: true,
        data: {
          document: {
            ...rootDoc,
            _id: rootDoc._id.toString(),
            parentId: rootDoc.parentId?.toString() || null
          },
          children,
          childCount,
          exceededLimit: childCount > 10 // Warning flag for frontend
        },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      logger.error('Error fetching document with children:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore recupero gerarchia documenti',
        'GET_DOCUMENT_HIERARCHY_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Create new document
   * POST /admin/documents
   * Body: { title, slug, description?, parentId?, contentDelta?, isDraft, visible, tags?, order? }
   */
  static async createDocument(req: Request, res: Response): Promise<void> {
    try {
      const { title, slug, description, parentId, contentDelta, isDraft, visible, tags, order } = req.body;

      // Validation
      if (!title || !slug) {
        res.status(400).json(errorResponse(
          'Titolo e slug sono obbligatori',
          'VALIDATION_ERROR',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Check if slug already exists
      const existingDoc = await Document.findOne({ slug });
      if (existingDoc) {
        res.status(409).json(errorResponse(
          'Esiste già un documento con questo slug',
          'DUPLICATE_SLUG',
          undefined,
          409,
          getRequestId(req)
        ));
        return;
      }

      // Validate parentId if provided
      if (parentId) {
        const parentExists = await Document.findById(parentId);
        if (!parentExists) {
          res.status(404).json(errorResponse(
            'Documento parent non trovato',
            'PARENT_NOT_FOUND',
            undefined,
            404,
            getRequestId(req)
          ));
          return;
        }
      }

      // Create new document
      const newDocument = new Document({
        title,
        slug,
        description: description || '',
        parentId: parentId || null,
        contentDelta: contentDelta || { type: 'doc', content: [] },
        isDraft: isDraft !== undefined ? isDraft : true, // Default to draft
        visible: visible !== undefined ? visible : true,
        tags: tags || [],
        order: order !== undefined ? order : 0,
        createdAt: new Date(),
        lastUpdated: new Date()
      });

      await newDocument.save();

      logger.info(`Document created: ${newDocument._id} (${title})`);

      res.status(201).json({
        result: true,
        success: true,
        data: newDocument,
        message: 'Documento creato con successo',
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      logger.error('Error creating document:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore creazione documento',
        'CREATE_DOCUMENT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Create new route
   * POST /admin/routes
   * Body: { path, type, kind, title, description?, rootDocumentId?, parentId?, redirectTo?, isPublic?, enabled?, order? }
   */
  static async createRoute(req: Request, res: Response): Promise<void> {
    try {
      const {
        slug,  // CHANGED: slug instead of path (path is calculated by pre-save hook)
        type,
        kind,
        title,
        description,
        rootDocumentId,
        documentData, // NEW: Create document inline for kind="document"
        parentId,
        redirectTo,
        isPublic,
        enabled,
        order
      } = req.body;

      // Validation
      if (!slug || !type || !kind || !title) {
        res.status(400).json(errorResponse(
          'Slug, type, kind e title sono obbligatori',
          'VALIDATION_ERROR',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate type
      if (!['ambientazione', 'approfondimenti', 'regolamento'].includes(type)) {
        res.status(400).json(errorResponse(
          'Type deve essere "ambientazione", "approfondimenti" o "regolamento"',
          'INVALID_TYPE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate kind
      if (!['document', 'category', 'redirect'].includes(kind)) {
        res.status(400).json(errorResponse(
          'Kind deve essere "document", "category" o "redirect"',
          'INVALID_KIND',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate kind-specific requirements
      if (kind === 'document' && !rootDocumentId && !documentData) {
        res.status(400).json(errorResponse(
          'Per kind="document" è obbligatorio fornire rootDocumentId o documentData',
          'MISSING_DOCUMENT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (kind === 'redirect' && !redirectTo) {
        res.status(400).json(errorResponse(
          'redirectTo è obbligatorio per kind="redirect"',
          'MISSING_REDIRECT_TO',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // ⚠️ CRITICAL VALIDATION: Prevent routes for second-level documents
      // Only root-level documents (parentId = null) can have routes
      if (kind === 'document') {
        let documentToCheck: any = null;

        // Case 1: Using existing document (rootDocumentId provided)
        if (rootDocumentId) {
          documentToCheck = await Document.findById(rootDocumentId);
          if (!documentToCheck) {
            res.status(404).json(errorResponse(
              'Documento specificato non trovato',
              'DOCUMENT_NOT_FOUND',
              undefined,
              404,
              getRequestId(req)
            ));
            return;
          }
        }

        // Case 2: Creating new document inline (documentData provided)
        if (documentData && documentData.parentId) {
          // Child document can have route ONLY if parent has a route
          const parentRoute = await Route.findOne({ rootDocumentId: documentData.parentId });
          if (!parentRoute) {
            res.status(400).json(errorResponse(
              'Impossibile creare route per questo documento: il parent non ha una route. Solo documenti il cui parent ha già una route possono avere routes proprie.',
              'PARENT_ROUTE_REQUIRED',
              { parentId: documentData.parentId },
              400,
              getRequestId(req)
            ));
            return;
          }
        }

        // Check if existing document has parentId → check if parent has route
        if (documentToCheck && documentToCheck.parentId) {
          const parentRoute = await Route.findOne({ rootDocumentId: documentToCheck.parentId });
          if (!parentRoute) {
            res.status(400).json(errorResponse(
              'Impossibile creare route per questo documento: il parent non ha una route. Solo documenti il cui parent ha già una route possono avere routes proprie.',
              'PARENT_ROUTE_REQUIRED',
              { documentId: rootDocumentId, parentId: documentToCheck.parentId.toString() },
              400,
              getRequestId(req)
            ));
            return;
          }
        }
      }

      // Check if slug+parentId already exists for this type
      const existingRoute = await Route.findOne({ slug, parentId: parentId || null, type });
      if (existingRoute) {
        res.status(409).json(errorResponse(
          'Esiste già una route con questo slug e parent per questo type',
          'DUPLICATE_SLUG',
          undefined,
          409,
          getRequestId(req)
        ));
        return;
      }

      // Create document inline if documentData provided (NEW FEATURE)
      let finalDocumentId = rootDocumentId;
      let routeSlug = slug;  // CHANGED: Use slug directly from body
      let documentToCheck: any = null;  // FIX: Track created/existing document for parent route detection

      if (kind === 'document' && documentData) {
        const { title: docTitle, slug: docSlug, description: docDescription } = documentData;
        routeSlug = docSlug; // Use document slug for route

        // Validate document data
        if (!docTitle || !docSlug) {
          res.status(400).json(errorResponse(
            'documentData.title e documentData.slug sono obbligatori',
            'INVALID_DOCUMENT_DATA',
            undefined,
            400,
            getRequestId(req)
          ));
          return;
        }

        // Check if slug already exists
        const existingDoc = await Document.findOne({ slug: docSlug });
        if (existingDoc) {
          res.status(409).json(errorResponse(
            'Esiste già un documento con questo slug',
            'DUPLICATE_SLUG',
            undefined,
            409,
            getRequestId(req)
          ));
          return;
        }

        // Create document
        const newDocument = new Document({
          title: docTitle,
          slug: docSlug,
          type,  // ADDED: Document.type must match Route.type (foreign key validation)
          description: docDescription || '',
          parentId: null,
          contentDelta: { type: 'doc', content: [] }, // Empty content initially
          isDraft: documentData.isDraft !== undefined ? documentData.isDraft : true,
          visible: documentData.visible !== undefined ? documentData.visible : true,
          tags: [],
          order: 0,
          createdAt: new Date(),
          lastUpdated: new Date()
        });

        await newDocument.save();
        finalDocumentId = newDocument._id.toString();
        documentToCheck = newDocument;  // FIX: Store for parent route detection

        logger.info(`Document created inline: ${newDocument._id} (${docSlug})`);
      } else if (rootDocumentId) {
        // Validate rootDocumentId if provided (backward compatibility)
        const docExists = await Document.findById(rootDocumentId);
        if (!docExists) {
          res.status(404).json(errorResponse(
            'Documento specificato non trovato',
            'DOCUMENT_NOT_FOUND',
            undefined,
            404,
            getRequestId(req)
          ));
          return;
        }
        documentToCheck = docExists;  // FIX: Store for parent route detection
      }

      // Determine route parentId
      let routeParentId = parentId || null;

      // If no explicit parentId but document has parentId → auto-find parent route
      if (!routeParentId && documentToCheck && documentToCheck.parentId) {
        const parentRoute = await Route.findOne({ rootDocumentId: documentToCheck.parentId });
        if (parentRoute) {
          routeParentId = parentRoute._id;
          logger.info(`Auto-detected parent route: ${routeParentId} for child document ${documentToCheck._id}`);
        }
      }

      // Validate parentId if provided
      if (routeParentId) {
        const parentExists = await Route.findById(routeParentId);
        if (!parentExists) {
          res.status(404).json(errorResponse(
            'Route parent non trovata',
            'PARENT_NOT_FOUND',
            undefined,
            404,
            getRequestId(req)
          ));
          return;
        }
      }

      // Create new route (path will be calculated by pre-save hook)
      const newRoute = new Route({
        slug: routeSlug,
        // path is NOT provided - will be calculated by pre-save hook from parentId + slug
        type,
        kind,
        title,
        description: description || '',
        rootDocumentId: finalDocumentId || null,
        parentId: routeParentId,
        redirectTo: redirectTo || null,
        isPublic: isPublic !== undefined ? isPublic : true,
        enabled: enabled !== undefined ? enabled : true,
        order: order !== undefined ? order : 0,
        createdAt: new Date(),
        lastUpdated: new Date()
      });

      await newRoute.save();  // Pre-save hook calculates path

      logger.info(`Route created: ${newRoute._id} (${newRoute.path})`);

      res.status(201).json({
        result: true,
        success: true,
        data: newRoute,
        message: 'Route creata con successo',
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      logger.error('Error creating route:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore creazione route',
        'CREATE_ROUTE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}
