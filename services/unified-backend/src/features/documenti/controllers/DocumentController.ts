/**
 * DocumentController
 *
 * Handles document retrieval via direct Document lookup (no Route model).
 * Public API for documents visualization (frontend apps/documents).
 * Supports semantic search and favorites management.
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Document from '../models/Document';
import DocumentSubtype from '../models/DocumentSubtype';
import { EmbeddingService } from '../services/EmbeddingService';
import { HierarchyService } from '../services/HierarchyService';
import { logger } from '@shared/utils/logger';
import { isQuestion } from '../utils/questionDetector';
import { extensions } from '@core/extensions/registry';
import type { ContextChunk } from '@core/extensions/points';

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

      const filter: Record<string, unknown> = {
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
        description: doc.description || '',
        type: doc.type,
        path: doc.path,
        content: doc.content,
        tags: doc.tags || [],
        isDraft: doc.isDraft || false,
        draftNotes: doc.draftNotes,
        isPublic: doc.isPublic,
        createdAt: doc.createdAt,
        lastUpdated: doc.lastUpdated
      };

      const convertChunk = (chunk: { _id: { toString(): string }; documentId: { toString(): string }; heading: string; slug: string; content: string; headingLevel: number; order: number }, depth: number = 0) => ({
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
            sections: rootChunks.map(c => convertChunk(c as unknown as Parameters<typeof convertChunk>[0])),
            hasChildren: false
          }
        });
        return;
      }

      // Build hierarchical children
      const hierarchicalChildren = await HierarchyService.buildHierarchicalChildren(
        doc._id, doc.path, doc.type as 'ambientazione' | 'regolamento', 0, 5
      );

      const hasAnyChildWithSeparatePage = (children: Array<{ hasOwnPage?: boolean; children?: Array<{ hasOwnPage?: boolean; children?: unknown[] }> }>): boolean =>
        children.some(child => child.hasOwnPage || hasAnyChildWithSeparatePage((child.children || []) as Array<{ hasOwnPage?: boolean; children?: Array<{ hasOwnPage?: boolean; children?: unknown[] }> }>));

      if (hasAnyChildWithSeparatePage(hierarchicalChildren)) {
        res.json({
          result: true,
          data: {
            route: { path: doc.path, type: doc.type, kind: 'document', isPublic: doc.isPublic, enabled: true },
            document,
            sections: rootChunks.map(c => convertChunk(c as unknown as Parameters<typeof convertChunk>[0])),
            hasChildren: false,
            childDocuments: hierarchicalChildren
          }
        });
        return;
      }

      // Assemble full hierarchy
      const allSections: Record<string, unknown>[] = rootChunks.map(c => ({ ...convertChunk(c as unknown as Parameters<typeof convertChunk>[0]), isRootChunk: true }));

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

        childChunks.forEach((chunk, chunkIndex: number) => {
          allSections.push({
            ...convertChunk(chunk as unknown as Parameters<typeof convertChunk>[0], depth),
            order: order + (chunkIndex * 0.01),
            parentDocumentId: childDoc._id.toString()
          });
        });
      }

      allSections.sort((a, b) => (a.order as number) - (b.order as number));

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

    } catch (error: unknown) {
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
      const { type, all } = req.query;

      const filter: Record<string, unknown> = {
        deletedAt: null,
        isDraft: { $ne: true },
        visible: { $ne: false },
      };

      // Include all documents (not just roots) when all=true (for ISR getStaticPaths)
      if (all !== 'true') {
        filter.parentId = null;
      }

      // CWE-943: guardia già reale (includes() su stringhe letterali non
      // combacia mai con un oggetto), ma typeof esplicito rimuove
      // l'ambiguità del cast `as string` per l'analisi statica.
      if (typeof type === 'string' && ['ambientazione', 'regolamento'].includes(type)) {
        filter.type = type;
      }

      if (!req.user) {
        filter.isPublic = true;
      }

      const docs = await Document.find(filter)
        .select('path type title isPublic slug order')
        .sort({ type: 1, order: 1 })
        .lean();

      const data = docs.map(doc => ({
        ...doc,
        _id: doc._id.toString(),
        kind: 'document',
        hasDocument: doc._id
      }));

      res.json({ result: true, data });
    } catch (error: unknown) {
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

      const docFilter: Record<string, unknown> = {
        deletedAt: null,
        isDraft: { $ne: true },
        visible: { $ne: false },
      };

      if (!req.user) {
        docFilter.isPublic = true;
      }

      const allDocuments = await Document.find(docFilter)
        .select('slug title path type subtypeId order isPublic parentId')
        .sort({ order: 1 })
        .lean();

      // Index docs by parentId for fast tree building
      const childrenByParent = new Map<string, typeof allDocuments>();
      const rootDocs: typeof allDocuments = [];

      allDocuments.forEach(doc => {
        if (!doc.parentId) {
          rootDocs.push(doc);
        } else {
          const parentKey = doc.parentId.toString();
          if (!childrenByParent.has(parentKey)) {
            childrenByParent.set(parentKey, []);
          }
          childrenByParent.get(parentKey)!.push(doc);
        }
      });

      // Recursively build tree node
      const buildTreeNode = (doc: typeof allDocuments[number]): Record<string, unknown> => {
        const docId = doc._id.toString();
        const kids = childrenByParent.get(docId) || [];
        return {
          _id: docId,
          slug: doc.slug,
          title: doc.title,
          path: doc.path,
          isPublic: doc.isPublic,
          order: doc.order,
          children: kids.map(buildTreeNode),
        };
      };

      // Group root documents by subtypeId
      const docsBySubtype = new Map<string, Record<string, unknown>[]>();
      rootDocs.forEach(doc => {
        const key = doc.subtypeId?.toString() || 'default';
        if (!docsBySubtype.has(key)) {
          docsBySubtype.set(key, []);
        }
        docsBySubtype.get(key)!.push(buildTreeNode(doc));
      });

      // Build grouped response
      const grouped: Record<string, Record<string, unknown>[]> = {
        ambientazione: [],
        regolamento: []
      };

      subtypes.forEach(subtype => {
        const subtypeId = subtype._id.toString();
        const subtypeDocs = docsBySubtype.get(subtypeId) || [];

        if (subtypeDocs.length > 0 || req.user) {
          grouped[subtype.type]?.push({
            _id: subtypeId,
            slug: subtype.slug,
            title: subtype.title,
            order: subtype.order,
            expandedByDefault: subtype.expandedByDefault,
            documents: subtypeDocs
          });
        }
      });

      res.json({ result: true, data: { routes: grouped } });
    } catch (error: unknown) {
      logger.error('Error in listRoutesHierarchical:', error);
      res.status(500).json({ result: false, error: 'Errore recupero documenti gerarchici', code: 'LIST_HIERARCHICAL_ERROR' });
    }
  }

  /**
   * GET /documents/search
   * Full-text search using MongoDB text index
   */
  static async textSearch(req: Request, res: Response): Promise<void> {
    try {
      const { q, type } = req.query;

      if (!q || typeof q !== 'string') {
        res.status(400).json({ result: false, error: 'Query parameter "q" required', code: 'MISSING_QUERY' });
        return;
      }

      // MongoDB text search query
      const filter: Record<string, unknown> = {
        $text: { $search: q },
        deletedAt: null,
        isDraft: { $ne: true },
        visible: { $ne: false }
      };

      // Only show public documents to non-authenticated users
      if (!req.user) {
        filter.isPublic = true;
      }

      // Optional type filter
      // CWE-943: guardia già reale (includes() su stringhe letterali non
      // combacia mai con un oggetto), ma typeof esplicito rimuove
      // l'ambiguità del cast `as string` per l'analisi statica.
      if (typeof type === 'string' && ['ambientazione', 'regolamento'].includes(type)) {
        filter.type = type;
      }

      const results = await Document.find(filter)
        .select('title path type slug')
        .sort({ score: { $meta: 'textScore' } })
        .limit(20)
        .lean();

      const data = results.map(doc => ({
        title: doc.title,
        url: `/${doc.type}/${doc.path}`,
        type: doc.type
      }));

      res.json({
        result: true,
        data: {
          query: q,
          results: data,
          count: data.length
        }
      });
    } catch (error: unknown) {
      logger.error('[textSearch] Error:', error);
      res.status(500).json({ result: false, error: 'Search failed', code: 'SEARCH_ERROR' });
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

      const displayLimit = Math.min(Number(limit) || 5, 10);
      const aiLimit = 10;
      const fetchLimit = Math.max(displayLimit, aiLimit);

      const searchResults = await EmbeddingService.semanticSearch(
        query, type as 'ambientazione' | 'regolamento' | undefined, fetchLimit, Number(minSimilarity)
      );

      if (searchResults.length === 0) {
        res.json({ result: true, data: { results: [], totalResults: 0, query } });
        return;
      }

      const chunkIds = searchResults.map(r => r.chunkId).filter(Boolean);
      const db = mongoose.connection.db;
      if (!db) throw new Error('Database connection not available');

      const chunks = await db.collection('documentchunks').find({ chunkId: { $in: chunkIds } }).toArray();

      // Sezioni troppo lunghe per il subprocess di embedding vengono spezzate
      // in più chunk in scrittura (embeddings-worker/ChunkParser.splitOversizedChunk),
      // che condividono {documentId, slug} come chiave di riaggancio. La
      // ricerca vettoriale può far match su UN SOLO pezzo: qui si recuperano
      // tutti i fratelli e si ricompone il contenuto intero della sezione,
      // così il Bibliotecario risponde sempre sul testo completo e non solo
      // sul frammento che ha fatto match.
      const splitGroups = [...new Set(
        chunks.filter(c => (c.splitTotal ?? 1) > 1).map(c => `${c.documentId}::${c.slug}`)
      )];
      if (splitGroups.length > 0) {
        const siblings = await db.collection('documentchunks').find({
          $or: splitGroups.map(key => {
            const [documentId, slug] = key.split('::');
            return { documentId, slug };
          })
        }).toArray();

        const reassembledByGroup = new Map<string, string>();
        for (const key of splitGroups) {
          const [documentId, slug] = key.split('::');
          const piecesContent = siblings
            .filter(s => s.documentId === documentId && s.slug === slug)
            .sort((a, b) => (a.splitIndex ?? 0) - (b.splitIndex ?? 0))
            .map(s => s.content);
          reassembledByGroup.set(key, piecesContent.join('\n\n'));
        }

        for (const chunk of chunks) {
          if ((chunk.splitTotal ?? 1) > 1) {
            chunk.content = reassembledByGroup.get(`${chunk.documentId}::${chunk.slug}`) ?? chunk.content;
          }
        }
      }

      const documentIds = chunks.map(c => c.documentId).filter(Boolean);
      const docFilter: Record<string, unknown> = {
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

      const subtypeIds = [...new Set(docs.map(d => d.subtypeId.toString()))];
      const subtypes = await db.collection('documentsubtypes').find({
        _id: { $in: subtypeIds.map(id => new mongoose.Types.ObjectId(id)) }
      }).toArray();
      const subtypeMap = new Map(subtypes.map(s => [s._id.toString(), s]));

      const RRF_K = 60;
      const maxRrfScore = 2 / (RRF_K + 1);

      const results = searchResults.map(result => {
        const chunk = chunks.find(c => c.chunkId === result.chunkId);
        if (!chunk) return null;

        const doc = docMap.get(chunk.documentId.toString());
        if (!doc) return null;

        const anchorSlug = result.slug;
        const subtype = subtypeMap.get(doc.subtypeId.toString());
        const normalizedScore = Math.min((result.score / maxRrfScore) * 100, 100);

        return {
          document: {
            _id: doc._id,
            slug: doc.slug,
            title: doc.title,
            content: chunk.content.substring(0, 300) + (chunk.content.length > 300 ? '...' : ''),
            tags: doc.tags || [],
            isDraft: doc.isDraft || false
          },
          route: {
            path: doc.path,
            type: doc.type,
            subtypeTitle: subtype?.title || '',
            anchor: `#${anchorSlug}`,
            fullPath: `/${doc.type}/${doc.path}#${anchorSlug}`
          },
          matchLevel: chunk.headingLevel,
          matchHeading: result.heading,
          similarity: result.score,
          matchScore: normalizedScore.toFixed(0) + '%'
        };
      }).filter(Boolean);

      const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null);
      const displayResults = validResults.slice(0, displayLimit);

      const MIN_AI_SCORE = 35;
      const relevantResults = validResults.filter(r => parseInt(r.matchScore) >= MIN_AI_SCORE).slice(0, aiLimit);
      const shouldUseAI = isQuestion(query) && relevantResults.length > 0;

      if (!shouldUseAI) {
        res.json({
          result: true,
          data: { results: displayResults, totalResults: displayResults.length, query },
        });
        return;
      }

      // --- SSE mode: stream results + AI answer + enrichments ---
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const sendSSE = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      sendSSE('results', {
        result: true,
        data: { results: displayResults, totalResults: displayResults.length, query },
      });

      const keepAlive = setInterval(() => {
        res.write(': keepalive\n\n');
      }, 15000);

      const abortController = new AbortController();

      req.on('close', () => {
        abortController.abort();
        clearInterval(keepAlive);
      });

      const contextChunks: ContextChunk[] = relevantResults.map(r => {
        const chunkId = searchResults.find(sr => sr.heading === r.matchHeading && sr.slug === r.route?.anchor?.replace('#', ''))?.chunkId;
        const chunk = chunkId ? chunks.find(c => c.chunkId === chunkId) : null;
        return {
          heading: r.matchHeading,
          content: (chunk?.content || '').substring(0, 1500),
          source: {
            documentId: r.document?._id?.toString(),
            slug: r.document?.slug,
            fullPath: r.route?.fullPath,
            title: r.document?.title,
            subtypeTitle: r.route?.subtypeTitle || '',
          },
        };
      });

      await extensions.emit('documents.search.stream', {
        question: query,
        chunks: contextChunks,
        sse: { send: sendSSE },
        signal: abortController.signal,
      });
      if (!abortController.signal.aborted) {
        sendSSE('complete', {});
        res.end();
      }
      clearInterval(keepAlive);
    } catch (error: unknown) {
      logger.error('Error in semanticSearch:', error);
      if (!res.headersSent) {
        res.status(500).json({ result: false, error: 'Errore semantic search', code: 'SEARCH_ERROR' });
      } else {
        try { res.end(); } catch { /* connection already closed */ }
      }
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
    } catch (error: unknown) {
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
        type: type as 'ambientazione' | 'regolamento',
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
    } catch (error: unknown) {
      logger.error('Error in toggleFavorite:', error);
      res.status(500).json({ result: false, error: 'Errore toggle favorite', code: 'FAVORITE_ERROR' });
    }
  }

  /**
   * GET /documents/ai-status
   * Returns whether the AI gateway is healthy and available for Q&A.
   * aiAvailable resta false se nessuna feature registrata sul filter la
   * abilita (es. bibliotecario spento) — vedi core/extensions/registry.ts.
   */
  static async aiStatus(req: Request, res: Response): Promise<void> {
    try {
      const capabilities = await extensions.apply('documents.search.capabilities', { aiAvailable: false }, { userId: req.user?.userId });
      res.json({ result: true, data: capabilities });
    } catch {
      res.json({ result: true, data: { aiAvailable: false } });
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
