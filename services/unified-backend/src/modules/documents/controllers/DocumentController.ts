/**
 * DocumentController
 *
 * Handles document retrieval via direct Document lookup (no Route model).
 * Public API for documents visualization (frontend apps/documents).
 * Supports semantic search and favorites management.
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Document from '@database/models/Document';
import DocumentSubtype from '@database/models/DocumentSubtype';
import { EmbeddingService } from '../services/EmbeddingService';
import { HierarchyService } from '../services/HierarchyService';
import { logger } from '@shared/utils/logger';

export class DocumentController {
  // ========== PUBLIC ROUTES ==========

  /**
   * GET /documents/:type/:path(*)
   * Get document by type + path (e.g., ambientazione/introduzione/presentazione)
   */
  static async getByPath(req: Request<{ type: string; path: string }>, res: Response): Promise<void> {
    const { type, path } = req.params;

    try {
      if (!['ambientazione', 'regolamento'].includes(type)) {
        res.status(400).json({ result: false, error: 'Tipo non valido', code: 'INVALID_TYPE' });
        return;
      }

      const filter: any = {
        type,
        path,
        deletedAt: null,
        isDraft: false,
        visible: true
      };

      if (!req.user) {
        filter.isPublic = true;
      }

      const doc = await Document.findOne(filter);

      if (!doc) {
        res.status(404).json({ result: false, error: 'Risorsa non trovata', code: 'NOT_FOUND' });
        return;
      }

      // Build response with sections from child documents + chunks
      const childrenWithDepth = await HierarchyService.fetchChildDocuments(doc._id);
      const hasChildren = childrenWithDepth.length > 0;

      const db = mongoose.connection.db;
      if (!db) {
        throw new Error('Database connection not available');
      }

      const rootChunks = await db.collection('documentchunks').find({
        documentId: doc._id.toString(),
        isActive: true
      }).sort({ order: 1 }).toArray();

      const document = {
        _id: doc._id.toString(),
        slug: doc.slug,
        title: doc.title,
        type: doc.type,
        path: doc.path,
        content: doc.content,
        description: doc.description,
        tags: doc.tags || [],
        isDraft: doc.isDraft || false,
        draftNotes: doc.draftNotes,
        isPublic: doc.isPublic
      };

      const convertChunk = (chunk: any, depth: number = 0) => ({
        _id: chunk._id.toString(),
        documentId: chunk.documentId.toString(),
        title: chunk.heading,
        slug: chunk.slug,
        content: DocumentController.convertPlainTextToHTML(chunk.content, chunk.headingLevel),
        order: chunk.order,
        depth
      });

      if (!hasChildren) {
        res.json({
          result: true,
          data: {
            route: { path: doc.path, type: doc.type, kind: 'document', isPublic: doc.isPublic, enabled: true },
            document,
            sections: rootChunks.map(c => convertChunk(c)),
            hasChildren: false
          }
        });
        return;
      }

      // Build hierarchical children
      const hierarchicalChildren = await HierarchyService.buildHierarchicalChildren(
        doc._id, doc.path, doc.type as any, 0, 5
      );

      const hasAnyChildWithSeparatePage = (children: any[]): boolean =>
        children.some(child => child.hasOwnPage || hasAnyChildWithSeparatePage(child.children || []));

      if (hasAnyChildWithSeparatePage(hierarchicalChildren)) {
        res.json({
          result: true,
          data: {
            route: { path: doc.path, type: doc.type, kind: 'document', isPublic: doc.isPublic, enabled: true },
            document,
            sections: rootChunks.map(c => convertChunk(c)),
            hasChildren: false,
            childDocuments: hierarchicalChildren
          }
        });
        return;
      }

      // Assemble full hierarchy
      const allSections: any[] = rootChunks.map(c => ({ ...convertChunk(c), isRootChunk: true }));

      for (const { document: childDoc, depth, order } of childrenWithDepth) {
        const childChunks = await db.collection('documentchunks').find({
          documentId: childDoc._id.toString(),
          isActive: true
        }).sort({ order: 1 }).toArray();

        allSections.push({
          _id: childDoc._id.toString(),
          documentId: childDoc._id.toString(),
          title: childDoc.title,
          slug: childDoc.slug,
          content: `<h${depth + 1}>${childDoc.title}</h${depth + 1}>`,
          order,
          depth,
          isDocumentTitle: true
        });

        childChunks.forEach((chunk: any, chunkIndex: number) => {
          allSections.push({
            ...convertChunk(chunk, depth),
            order: order + (chunkIndex * 0.01),
            parentDocumentId: childDoc._id.toString()
          });
        });
      }

      allSections.sort((a, b) => a.order - b.order);

      res.json({
        result: true,
        data: {
          route: { path: doc.path, type: doc.type, kind: 'document', isPublic: doc.isPublic, enabled: true },
          document,
          sections: allSections,
          hasChildren: true,
          childDocuments: childrenWithDepth.map(({ document: childDoc, depth }) => ({
            _id: childDoc._id.toString(),
            slug: childDoc.slug,
            title: childDoc.title,
            hasOwnPage: false,
            depth,
            order: childDoc.order,
            children: []
          }))
        }
      });

    } catch (error: any) {
      logger.error('Error in getByPath:', error);
      res.status(500).json({ result: false, error: 'Errore recupero documento', code: 'GET_DOCUMENT_ERROR' });
    }
  }

  /**
   * GET /documents/routes/list
   * List top-level documents (for navigation/menu)
   */
  static async listRoutes(req: Request, res: Response): Promise<void> {
    try {
      const { type } = req.query;

      const filter: any = {
        deletedAt: null,
        isDraft: { $ne: true },
        visible: { $ne: false },
        parentId: null
      };

      if (type && ['ambientazione', 'regolamento'].includes(type as string)) {
        filter.type = type;
      }

      if (!req.user) {
        filter.isPublic = true;
      }

      const docs = await Document.find(filter)
        .select('path type title description isPublic slug order')
        .sort({ type: 1, order: 1 })
        .lean();

      const data = docs.map(doc => ({
        ...doc,
        _id: doc._id.toString(),
        kind: 'document',
        hasDocument: doc._id
      }));

      res.json({ result: true, data });
    } catch (error: any) {
      logger.error('Error in listRoutes:', error);
      res.status(500).json({ result: false, error: 'Errore recupero documenti', code: 'LIST_DOCUMENTS_ERROR' });
    }
  }

  /**
   * GET /documents/routes/list-hierarchical
   * List documents grouped by subtype within each type
   */
  static async listRoutesHierarchical(req: Request, res: Response): Promise<void> {
    try {
      const subtypes = await DocumentSubtype.find().sort({ type: 1, order: 1 }).lean();

      const docFilter: any = {
        deletedAt: null,
        isDraft: { $ne: true },
        visible: { $ne: false },
        parentId: null
      };

      if (!req.user) {
        docFilter.isPublic = true;
      }

      const documents = await Document.find(docFilter)
        .select('slug title path type subtypeId order isPublic')
        .sort({ order: 1 })
        .lean();

      // Group documents by subtypeId
      const docsBySubtype = new Map<string, any[]>();
      documents.forEach(doc => {
        const key = doc.subtypeId.toString();
        if (!docsBySubtype.has(key)) {
          docsBySubtype.set(key, []);
        }
        docsBySubtype.get(key)!.push({
          _id: doc._id.toString(),
          slug: doc.slug,
          title: doc.title,
          path: doc.path,
          isPublic: doc.isPublic,
          order: doc.order
        });
      });

      // Build grouped response
      const grouped: Record<string, any[]> = {
        ambientazione: [],
        regolamento: []
      };

      subtypes.forEach(subtype => {
        const subtypeId = subtype._id.toString();
        const subtypeDocs = docsBySubtype.get(subtypeId) || [];

        // Only include subtypes that have at least one visible document
        // (or all subtypes if user is authenticated)
        if (subtypeDocs.length > 0 || req.user) {
          grouped[subtype.type]?.push({
            _id: subtypeId,
            slug: subtype.slug,
            title: subtype.title,
            order: subtype.order,
            documents: subtypeDocs
          });
        }
      });

      res.json({ result: true, routes: grouped });
    } catch (error: any) {
      logger.error('Error in listRoutesHierarchical:', error);
      res.status(500).json({ result: false, error: 'Errore recupero documenti gerarchici', code: 'LIST_HIERARCHICAL_ERROR' });
    }
  }

  /**
   * GET /documents/semantic-search
   */
  static async semanticSearch(req: Request, res: Response): Promise<void> {
    try {
      const { q: query, type, limit = 5, minSimilarity = 0.01 } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ result: false, error: 'Query richiesta', code: 'MISSING_QUERY' });
        return;
      }

      const searchResults = await EmbeddingService.semanticSearch(
        query, type as any, Number(limit), Number(minSimilarity)
      );

      if (searchResults.length === 0) {
        res.json({ result: true, data: { results: [], totalResults: 0, query } });
        return;
      }

      const chunkIds = searchResults.map(r => r.chunkId).filter(Boolean);
      const db = mongoose.connection.db;
      if (!db) throw new Error('Database connection not available');

      const chunks = await db.collection('documentchunks').find({ chunkId: { $in: chunkIds } }).toArray();

      const documentIds = chunks.map(c => c.documentId).filter(Boolean);
      const docFilter: any = {
        _id: { $in: documentIds.map(id => new mongoose.Types.ObjectId(id)) },
        deletedAt: null,
        isDraft: { $ne: true },
        visible: { $ne: false }
      };

      if (!req.user) {
        docFilter.isPublic = true;
      }

      const docs = await Document.find(docFilter).lean();
      const docMap = new Map(docs.map(d => [d._id.toString(), d]));

      const results = searchResults.map(result => {
        const chunk: any = chunks.find((c: any) => c.chunkId === result.chunkId);
        if (!chunk) return null;

        const doc = docMap.get(chunk.documentId.toString());
        if (!doc) return null;

        const anchorSlug = result.parentSlug || result.slug;

        return {
          document: {
            _id: doc._id,
            slug: doc.slug,
            title: doc.title,
            content: chunk.content.substring(0, 300) + (chunk.content.length > 300 ? '...' : ''),
            description: doc.description,
            tags: doc.tags || [],
            isDraft: doc.isDraft || false
          },
          route: {
            path: doc.path,
            type: doc.type,
            anchor: `#${anchorSlug}`,
            fullPath: `/${doc.type}/${doc.path}#${anchorSlug}`
          },
          matchLevel: chunk.headingLevel,
          matchHeading: result.heading,
          similarity: result.score,
          matchScore: (result.score * 100).toFixed(1) + '%'
        };
      }).filter(Boolean);

      res.json({ result: true, data: { results, totalResults: results.length, query } });
    } catch (error: any) {
      logger.error('Error in semanticSearch:', error);
      res.status(500).json({ result: false, error: 'Errore semantic search', code: 'SEARCH_ERROR' });
    }
  }

  /**
   * GET /documents/favorites
   */
  static async getFavorites(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ result: false, error: 'Autenticazione richiesta', code: 'UNAUTHORIZED' });
        return;
      }

      const db = mongoose.connection.db;
      if (!db) throw new Error('Database connection not available');

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
          $project: {
            id: '$_id',
            document: {
              _id: '$document._id',
              slug: '$document.slug',
              title: '$document.title',
              description: '$document.description',
              tags: '$document.tags',
              isDraft: '$document.isDraft',
              path: '$document.path',
              type: '$document.type'
            },
            route: {
              path: '$document.path',
              type: '$document.type'
            },
            addedAt: '$createdAt'
          }
        },
        { $sort: { addedAt: -1 } }
      ]).toArray();

      res.json({ result: true, data: favorites });
    } catch (error: any) {
      logger.error('Error in getFavorites:', error);
      res.status(500).json({ result: false, error: 'Errore recupero preferiti', code: 'GET_FAVORITES_ERROR' });
    }
  }

  /**
   * POST /documents/:type/:path/favorite
   */
  static async toggleFavorite(req: Request<{ type: string; path: string }>, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ result: false, error: 'Autenticazione richiesta', code: 'UNAUTHORIZED' });
        return;
      }

      const { type, path } = req.params;

      const document = await Document.findOne({
        type,
        path,
        deletedAt: null,
        isDraft: false,
        visible: true
      });

      if (!document) {
        res.status(404).json({ result: false, error: 'Documento non trovato', code: 'NOT_FOUND' });
        return;
      }

      const db = mongoose.connection.db;
      if (!db) throw new Error('Database connection not available');

      const existing = await db.collection('document_favorites').findOne({
        userId: req.user.userId,
        documentId: document._id
      });

      if (existing) {
        await db.collection('document_favorites').deleteOne({ _id: existing._id });
        res.json({ result: true, data: { favorited: false }, message: 'Rimosso dai preferiti' });
      } else {
        await db.collection('document_favorites').insertOne({
          userId: req.user.userId,
          documentId: document._id,
          createdAt: new Date()
        });
        res.json({ result: true, data: { favorited: true }, message: 'Aggiunto ai preferiti' });
      }
    } catch (error: any) {
      logger.error('Error in toggleFavorite:', error);
      res.status(500).json({ result: false, error: 'Errore toggle favorite', code: 'FAVORITE_ERROR' });
    }
  }

  // ========== PRIVATE HELPERS ==========

  private static convertPlainTextToHTML(content: string, headingLevel: number): string {
    if (!content || !content.trim()) return '<p>Contenuto non disponibile.</p>';

    const lines = content.trim().split('\n');
    const htmlParts: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.trim().match(/^[•\-\*]\s+/) || line.trim().match(/^\d+[\.\)]\s+/)) {
        const listItems: string[] = [];
        const isBullet = line.trim().match(/^[•\-\*]\s+/);

        while (i < lines.length && (lines[i].trim().match(/^[•\-\*]\s+/) || lines[i].trim().match(/^\d+[\.\)]\s+/))) {
          const itemText = lines[i].trim().replace(/^[•\-\*]\s+/, '').replace(/^\d+[\.\)]\s+/, '');
          const escaped = itemText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          listItems.push(`<li>${escaped}</li>`);
          i++;
        }

        const listTag = isBullet ? 'ul' : 'ol';
        htmlParts.push(`<${listTag}>\n${listItems.join('\n')}\n</${listTag}>`);
      } else if (line.trim()) {
        const escaped = line.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        htmlParts.push(`<p>${escaped}</p>`);
        i++;
      } else {
        i++;
      }
    }

    return htmlParts.join('\n');
  }
}
