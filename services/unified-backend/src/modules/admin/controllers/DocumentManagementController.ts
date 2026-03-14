import { Request, Response } from 'express';
import { db } from '@database/models';
import Document from '@database/models/Document';
import DocumentSubtype from '@database/models/DocumentSubtype';
import { logger } from '../utils/logger';
import { errorResponse, getRequestId } from '../utils/apiResponse';
import { DocumentChunkService } from '../services/DocumentChunkService';
import jwt from 'jsonwebtoken';
import { appConfig } from '@config/runtime';

const mongoose = db.getMongoose();

/**
 * Document Management Controller
 *
 * Uses Document model (single source of truth) + DocumentSubtype for grouping.
 */
export class DocumentManagementController {

  /**
   * Get documents tree grouped by subtype
   * GET /admin/documents?type=ambientazione|regolamento
   */
  static async getDocuments(req: Request, res: Response): Promise<void> {
    try {
      const { type, search } = req.query;

      if (!type || !['ambientazione', 'regolamento'].includes(type as string)) {
        res.status(400).json(errorResponse(
          'type is required (ambientazione or regolamento)',
          'VALIDATION_ERROR', undefined, 400, getRequestId(req)
        ));
        return;
      }

      const allDocuments = await Document.find({
        type,
        deleted: { $ne: true }
      }).populate('subtypeId', 'slug title order').lean();

      const buildDocumentTree = (parentId: string | null, depth: number = 0): any[] => {
        if (depth > 10) return [];

        return allDocuments
          .filter((doc: any) => {
            const pid = doc.parentId ? doc.parentId.toString() : null;
            return pid === parentId;
          })
          .sort((a: any, b: any) => a.order - b.order)
          .map((doc: any) => {
            const docId = doc._id.toString();

            if (search) {
              const searchLower = (search as string).toLowerCase();
              const matchesSearch =
                doc.title?.toLowerCase().includes(searchLower) ||
                doc.slug?.toLowerCase().includes(searchLower);
              if (!matchesSearch) return null;
            }

            return {
              _id: docId,
              slug: doc.slug,
              title: doc.title,
              isDraft: doc.isDraft,
              visible: doc.visible ?? true,
              isPublic: doc.isPublic ?? false,
              tags: doc.tags || [],
              order: doc.order,
              parentId: doc.parentId ? doc.parentId.toString() : null,
              path: doc.path,
              subtype: doc.subtypeId ? {
                _id: (doc.subtypeId as any)._id?.toString(),
                slug: (doc.subtypeId as any).slug,
                title: (doc.subtypeId as any).title
              } : null,
              children: buildDocumentTree(docId, depth + 1)
            };
          })
          .filter((doc: any) => doc !== null);
      };

      const data = buildDocumentTree(null);

      res.json({
        result: true,
        data,
        totalItems: data.length,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('Error getting documents tree:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore nel recupero documenti',
        'GET_DOCUMENTS_ERROR', undefined, 500, getRequestId(req)
      ));
    }
  }

  /**
   * Reorder siblings
   * PUT /admin/documents/reorder
   * Body: { parentId: string | null, orderedIds: string[] }
   */
  static async reorderSiblings(req: Request, res: Response): Promise<void> {
    try {
      const { parentId, orderedIds } = req.body;

      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        res.status(400).json(errorResponse(
          'orderedIds deve essere un array non vuoto',
          'INVALID_ORDERED_IDS', undefined, 400, getRequestId(req)
        ));
        return;
      }

      if (parentId) {
        const parent = await Document.findById(parentId);
        if (!parent) {
          res.status(404).json(errorResponse(
            'Parent document non trovato',
            'PARENT_DOCUMENT_NOT_FOUND', undefined, 404, getRequestId(req)
          ));
          return;
        }
      }

      const documents = await Document.find({ _id: { $in: orderedIds } });
      if (documents.length !== orderedIds.length) {
        res.status(404).json(errorResponse(
          'Alcuni documenti non sono stati trovati',
          'DOCUMENTS_NOT_FOUND', undefined, 404, getRequestId(req)
        ));
        return;
      }

      const bulkOps = orderedIds.map((docId: string, index: number) => ({
        updateOne: {
          filter: { _id: mongoose.Types.ObjectId.createFromHexString(docId) },
          update: { $set: { order: index + 1 } }
        }
      }));

      await Document.bulkWrite(bulkOps);

      logger.info(`Reordered ${orderedIds.length} siblings for parentId=${parentId || 'root'}`);

      res.json({
        result: true,
        data: {
          parentId: parentId || null,
          updated_count: orderedIds.length,
          order_range: [1, orderedIds.length]
        },
        message: `${orderedIds.length} documenti riordinati con successo`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('Error reordering siblings:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore nel riordinamento',
        'REORDER_SIBLINGS_ERROR', undefined, 500, getRequestId(req)
      ));
    }
  }

  /**
   * Update document
   * PATCH /admin/documents/:id
   */
  static async updateDocument(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const updates = req.body;

      const document = await Document.findById(id);

      if (!document) {
        res.status(404).json(errorResponse(
          'Documento non trovato', 'DOCUMENT_NOT_FOUND', undefined, 404, getRequestId(req)
        ));
        return;
      }

      const allowedFields = [
        'title', 'slug', 'type', 'subtypeId', 'contentDelta',
        'parentId', 'isDraft', 'visible', 'isPublic', 'tags', 'order', 'draftNotes'
      ];
      for (const key of allowedFields) {
        if (updates[key] !== undefined) {
          (document as any)[key] = updates[key];
        }
      }
      document.lastUpdated = new Date();

      await document.save();

      logger.info(`Document ${id} updated`, { updates });

      if (updates.contentDelta) {
        try {
          const authToken = req.cookies?.auth_token;
          if (authToken) {
            const decoded = jwt.verify(authToken, appConfig.jwt.secret!) as any;
            const chunkService = new DocumentChunkService();
            const result = await chunkService.regenerateChunksForDocument(
              id, updates.contentDelta, document.type, decoded.userId, decoded.username || 'Unknown'
            );

            if (result.success) {
              logger.info(`[ChunkSync] Chunks regenerated: ${result.chunksCreated} created, ${result.chunksDeactivated} deactivated (v${result.newVersion})`);
            } else {
              logger.error(`[ChunkSync] Chunk regeneration failed: ${result.error}`);
            }
          }
        } catch (chunkError: any) {
          logger.error('[ChunkSync] Chunk regeneration failed (non-fatal):', chunkError);
        }
      }

      res.json({
        result: true,
        data: document,
        message: 'Documento aggiornato con successo',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('Error updating document:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore aggiornamento documento',
        'UPDATE_DOCUMENT_ERROR', undefined, 500, getRequestId(req)
      ));
    }
  }

  /**
   * Regenerate chunks for a document
   * POST /admin/documents/:id/regenerate-chunks
   */
  static async regenerateChunks(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;

      const document = await Document.findById(id);
      if (!document) {
        res.status(404).json(errorResponse(
          'Documento non trovato', 'DOCUMENT_NOT_FOUND', undefined, 404, getRequestId(req)
        ));
        return;
      }

      const authToken = req.cookies?.auth_token;
      if (!authToken) {
        res.status(401).json(errorResponse(
          'Token di autenticazione mancante', 'NO_AUTH_TOKEN', undefined, 401, getRequestId(req)
        ));
        return;
      }

      const decoded = jwt.verify(authToken, appConfig.jwt.secret!) as any;

      const chunkService = new DocumentChunkService();
      const result = await chunkService.regenerateChunksForDocument(
        id, document.contentDelta, document.type, decoded.userId, decoded.username || 'Unknown'
      );

      if (result.success) {
        logger.info(`[ManualSync] Document ${id}: ${result.chunksCreated} chunks created (v${result.newVersion})`);
        res.json({
          result: true,
          data: { chunksCreated: result.chunksCreated, chunksDeactivated: result.chunksDeactivated, newVersion: result.newVersion },
          message: 'Chunks rigenerati con successo',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json(errorResponse(
          result.error || 'Errore durante la rigenerazione dei chunks',
          'CHUNK_REGEN_ERROR', undefined, 500, getRequestId(req)
        ));
      }
    } catch (error: any) {
      logger.error('[ManualSync] Error regenerating chunks:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore durante la rigenerazione dei chunks',
        'CHUNK_REGEN_ERROR', undefined, 500, getRequestId(req)
      ));
    }
  }

  /**
   * Soft delete document
   * DELETE /admin/documents/:id
   */
  static async deleteDocument(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const hasChildren = await Document.countDocuments({ parentId: id, deleted: { $ne: true } });
      if (hasChildren > 0) {
        res.status(400).json(errorResponse(
          'Impossibile eliminare un documento con figli. Eliminare prima i documenti figli.',
          'DOCUMENT_HAS_CHILDREN', { childCount: hasChildren }, 400, getRequestId(req)
        ));
        return;
      }

      const document = await Document.findByIdAndUpdate(
        id,
        { $set: { deleted: true, lastUpdated: new Date() } },
        { returnDocument: 'after' }
      );

      if (!document) {
        res.status(404).json(errorResponse(
          'Documento non trovato', 'DOCUMENT_NOT_FOUND', undefined, 404, getRequestId(req)
        ));
        return;
      }

      logger.info(`Document ${id} soft deleted`);
      res.json({ result: true, message: 'Documento eliminato con successo', timestamp: new Date().toISOString() });
    } catch (error: any) {
      logger.error('Error deleting document:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore eliminazione documento',
        'DELETE_DOCUMENT_ERROR', undefined, 500, getRequestId(req)
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
          'Documento non trovato', 'DOCUMENT_NOT_FOUND', undefined, 404, getRequestId(req)
        ));
        return;
      }

      document.visible = !document.visible;
      document.lastUpdated = new Date();
      await document.save();

      res.json({
        result: true,
        data: { visible: document.visible },
        message: `Documento ${document.visible ? 'reso visibile' : 'nascosto'} con successo`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('Error toggling document visibility:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore toggle visibilità documento',
        'TOGGLE_VISIBILITY_ERROR', undefined, 500, getRequestId(req)
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
          'Documento non trovato', 'DOCUMENT_NOT_FOUND', undefined, 404, getRequestId(req)
        ));
        return;
      }

      document.isDraft = !document.isDraft;
      document.lastUpdated = new Date();
      await document.save();

      res.json({
        result: true,
        data: { isDraft: document.isDraft },
        message: `Documento ${document.isDraft ? 'segnato come bozza' : 'pubblicato'} con successo`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('Error toggling document draft:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore toggle draft documento',
        'TOGGLE_DRAFT_ERROR', undefined, 500, getRequestId(req)
      ));
    }
  }

  /**
   * Get single document by ID (for editing)
   */
  static async getDocumentById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const document = await Document.findById(id).populate('subtypeId', 'slug title type order').lean();

      if (!document) {
        res.status(404).json(errorResponse(
          'Documento non trovato', 'DOCUMENT_NOT_FOUND', undefined, 404, getRequestId(req)
        ));
        return;
      }

      res.json({
        result: true,
        data: {
          ...document,
          _id: document._id.toString(),
          parentId: document.parentId?.toString() || null,
          subtypeId: document.subtypeId,
          lastUpdated: document.lastUpdated
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('Error fetching document:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore recupero documento',
        'GET_DOCUMENT_ERROR', undefined, 500, getRequestId(req)
      ));
    }
  }

  /**
   * Get document with all children recursively (for hierarchical editing)
   */
  static async getDocumentWithChildren(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const depth = parseInt(req.query.depth as string) || 10;

      const rootDoc = await Document.findById(id).lean();

      if (!rootDoc) {
        res.status(404).json(errorResponse(
          'Documento non trovato', 'DOCUMENT_NOT_FOUND', undefined, 404, getRequestId(req)
        ));
        return;
      }

      const fetchChildren = async (parentId: string, currentDepth: number): Promise<any[]> => {
        if (currentDepth >= depth) return [];

        const children = await Document.find({ parentId, deleted: { $ne: true } })
          .sort({ order: 1 }).lean();

        return Promise.all(
          children.map(async (child) => ({
            ...child,
            _id: child._id.toString(),
            parentId: child.parentId?.toString() || null,
            children: await fetchChildren(child._id.toString(), currentDepth + 1)
          }))
        );
      };

      const children = await fetchChildren(id, 0);

      res.json({
        result: true,
        data: {
          document: { ...rootDoc, _id: rootDoc._id.toString(), parentId: rootDoc.parentId?.toString() || null },
          children,
          childCount: children.length,
          exceededLimit: children.length > 10
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('Error fetching document with children:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore recupero gerarchia documenti',
        'GET_DOCUMENT_HIERARCHY_ERROR', undefined, 500, getRequestId(req)
      ));
    }
  }

  /**
   * Create new document
   * POST /admin/documents
   * Body: { title, slug, type, subtypeId, parentId?, contentDelta?, isDraft, visible, isPublic?, tags?, order? }
   */
  static async createDocument(req: Request, res: Response): Promise<void> {
    try {
      const { title, slug, type, subtypeId, parentId, contentDelta, isDraft, visible, isPublic, tags, order } = req.body;

      if (!title || !slug || !type || !subtypeId) {
        res.status(400).json(errorResponse(
          'Titolo, slug, type e subtypeId sono obbligatori',
          'VALIDATION_ERROR', undefined, 400, getRequestId(req)
        ));
        return;
      }

      if (!['ambientazione', 'regolamento'].includes(type)) {
        res.status(400).json(errorResponse(
          'type deve essere "ambientazione" o "regolamento"',
          'INVALID_TYPE', undefined, 400, getRequestId(req)
        ));
        return;
      }

      // Validate subtype exists and type matches
      const subtype = await DocumentSubtype.findById(subtypeId);
      if (!subtype) {
        res.status(404).json(errorResponse(
          'SubType non trovato', 'SUBTYPE_NOT_FOUND', undefined, 404, getRequestId(req)
        ));
        return;
      }

      if (subtype.type !== type) {
        res.status(400).json(errorResponse(
          `Il type del subtype (${subtype.type}) non corrisponde al type del documento (${type})`,
          'TYPE_MISMATCH', undefined, 400, getRequestId(req)
        ));
        return;
      }

      const existingDoc = await Document.findOne({ slug });
      if (existingDoc) {
        res.status(409).json(errorResponse(
          'Esiste già un documento con questo slug',
          'DUPLICATE_SLUG', undefined, 409, getRequestId(req)
        ));
        return;
      }

      if (parentId) {
        const parentExists = await Document.findById(parentId);
        if (!parentExists) {
          res.status(404).json(errorResponse(
            'Documento parent non trovato',
            'PARENT_NOT_FOUND', undefined, 404, getRequestId(req)
          ));
          return;
        }
      }

      const newDocument = new Document({
        title,
        slug,
        type,
        subtypeId,
        parentId: parentId || null,
        contentDelta: contentDelta || { type: 'doc', content: [] },
        isDraft: isDraft !== undefined ? isDraft : true,
        visible: visible !== undefined ? visible : true,
        isPublic: isPublic !== undefined ? isPublic : false,
        tags: tags || [],
        order: order !== undefined ? order : 0,
        createdAt: new Date(),
        lastUpdated: new Date()
      });

      await newDocument.save();

      logger.info(`Document created: ${newDocument._id} (${title})`);

      res.status(201).json({
        result: true,
        data: newDocument,
        message: 'Documento creato con successo',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('Error creating document:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore creazione documento',
        'CREATE_DOCUMENT_ERROR', undefined, 500, getRequestId(req)
      ));
    }
  }
}
