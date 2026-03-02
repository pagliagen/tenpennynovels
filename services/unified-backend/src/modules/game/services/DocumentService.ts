/**
 * DocumentService
 *
 * Service for routing and document retrieval using dual-table architecture.
 * Handles Route→Document resolution and hierarchy assembly.
 */

import mongoose from 'mongoose';
import Route from '@database/models/Route';
import Document from '@database/models/Document';
import { logger } from '@shared/utils/logger';
import { qdrant } from '../utils/qdrantClient';

const EMBEDDINGS_SERVICE_URL = process.env.EMBEDDINGS_SERVICE_URL || 'http://127.0.0.1:5001';
const ROUTES_COLLECTION = 'routes_vectors';

export interface RouteWithDocument {
  route: {
    path: string;
    type: 'ambientazione' | 'approfondimenti' | 'regolamento';
    kind: 'document' | 'category' | 'redirect';
    title: string;
    description?: string;
    isPublic: boolean;
    enabled: boolean;
    redirectTo?: string;  // NEW: Redirect target
  };
  document?: {
    _id: string;
    slug: string;
    title: string;
    type: 'ambientazione' | 'approfondimenti' | 'regolamento';
    path: string;  // Route path (e.g., "approfondimenti", "approfondimenti/classi-sociali")
    content?: string;  // HTML output (auto-generated with H1 anchor IDs)
    description?: string;
    tags: string[];
    isDraft: boolean;
    draftNotes?: string;
  };
  sections?: Array<{
    _id: string;
    documentId: string;
    title: string;
    slug: string;
    content: string;  // HTML content converted from chunks
    order: number;
    depth?: number;  // NEW: Hierarchy depth
    isDocumentTitle?: boolean;  // NEW: True if section is a document title
    isRootChunk?: boolean;  // NEW: True if section is from root document
    parentDocumentId?: string;  // NEW: Parent document ID if child
  }>;
  subRoutes?: Array<{
    path: string;
    title: string;
    description?: string;
    isPublic: boolean;
  }>;
  hasChildren?: boolean;  // NEW: True if document has child documents
  childDocuments?: Array<{  // NEW: Hierarchical child documents for TOC
    _id: string;
    slug: string;
    title: string;
    hasRoute: boolean;
    routePath?: string;  // Full path if hasRoute (e.g., "/ambientazione/approfondimenti/armi")
    depth: number;
    order: number;
    children: any[];  // Recursive structure
  }>;
}

export class DocumentService {
  /**
   * Recursively fetch all child documents for a parent document
   * @param parentDocId - Parent document MongoDB ObjectId
   * @param currentDepth - Current recursion depth (0 = root)
   * @param maxDepth - Maximum depth to traverse (default 5)
   * @returns Array of child documents with depth metadata
   */
  private static async fetchChildDocuments(
    parentDocId: mongoose.Types.ObjectId,
    currentDepth: number = 0,
    maxDepth: number = 5
  ): Promise<Array<{ document: any; depth: number; order: number }>> {
    if (currentDepth >= maxDepth) return [];

    // Fetch direct children sorted by order
    const children = await Document.find({
      parentId: parentDocId,
      visible: true,  // Only include visible children
      deleted: { $ne: true }  // Exclude soft-deleted documents
    }).sort({ order: 1 });

    const result: Array<{ document: any; depth: number; order: number }> = [];

    // Recursively fetch grandchildren
    for (const child of children) {
      result.push({
        document: child,
        depth: currentDepth + 1,
        order: child.order
      });

      // Recursively fetch this child's children
      const grandchildren = await this.fetchChildDocuments(
        child._id,
        currentDepth + 1,
        maxDepth
      );

      result.push(...grandchildren);
    }

    return result;
  }

  /**
   * Build hierarchical child documents structure with route information
   * Used for TOC generation with proper link types (external routes vs anchors)
   */
  private static async buildHierarchicalChildren(
    parentDocId: mongoose.Types.ObjectId,
    parentRoutePath: string,
    type: 'ambientazione' | 'approfondimenti' | 'regolamento',
    currentDepth: number = 0,
    maxDepth: number = 5
  ): Promise<any[]> {
    if (currentDepth >= maxDepth) return [];

    // Fetch direct children
    const children = await Document.find({
      parentId: parentDocId,
      visible: true,
      deleted: { $ne: true }  // Exclude soft-deleted documents
    }).sort({ order: 1 }).lean();

    if (children.length === 0) return [];

    // Get routes for all children in one query
    const childIds = children.map(c => c._id);
    const childRoutes = await Route.find({
      rootDocumentId: { $in: childIds },
      enabled: true
    }).lean();

    // Build route lookup map
    const routeMap = new Map();
    childRoutes.forEach(route => {
      if (route.rootDocumentId) {
        routeMap.set(route.rootDocumentId.toString(), route);
      }
    });

    // Build hierarchical structure
    const result = [];
    for (const child of children) {
      const childRoute = routeMap.get(child._id.toString());
      const hasRoute = !!childRoute;

      // Recursively get grandchildren
      const grandchildren = await this.buildHierarchicalChildren(
        child._id,
        hasRoute ? childRoute.path : parentRoutePath,
        type,
        currentDepth + 1,
        maxDepth
      );

      result.push({
        _id: child._id.toString(),
        slug: child.slug,
        title: child.title,
        hasRoute: hasRoute,
        routePath: hasRoute ? `/${type}/${childRoute.path}` : undefined,
        depth: currentDepth + 1,
        order: child.order,
        children: grandchildren
      });
    }

    return result;
  }

  /**
   * Get document or category by route path
   *
   * @param type - "ambientazione", "approfondimenti", or "regolamento"
   * @param urlPath - URL path (e.g., "folklore", "approfondimenti/medicina")
   * @returns Route with associated document(s) or sub-routes
   * @throws Error if route not found or disabled
   */
  static async getByPath(
    type: 'ambientazione' | 'approfondimenti' | 'regolamento',
    urlPath: string
  ): Promise<RouteWithDocument> {
    try {
      // ========== STEP 1: Lookup Route (check enabled) ==========
      const route = await Route.findOne({
        type,
        path: urlPath,
        enabled: true  // ⚠️ CRITICAL: only enabled routes
      });

      if (!route) {
        throw new Error('Route not found or disabled');
      }

      // Build base response
      const response: RouteWithDocument = {
        route: {
          path: route.path,
          type: route.type,
          kind: route.kind,
          title: route.title,
          description: route.description,
          isPublic: route.isPublic,
          enabled: route.enabled,
          redirectTo: route.redirectTo
        }
      };

      // ========== STEP 2: Based on kind, fetch data ==========

      // Handle redirects
      if (route.kind === 'redirect') {
        if (!route.redirectTo) {
          throw new Error('Redirect route missing redirectTo');
        }
        // Return immediately - controller will handle the 302 redirect
        return response;
      }

      if (route.kind === 'document') {
        // Fetch root document
        if (!route.rootDocumentId) {
          throw new Error('Document route missing rootDocumentId');
        }

        const rootDoc = await Document.findById(route.rootDocumentId);
        if (!rootDoc) {
          throw new Error('Root document not found');
        }

        // ⚠️ CRITICAL: Filter by visibility and draft status
        if (rootDoc.visible === false) {
          throw new Error('Document is hidden');
        }
        if (rootDoc.isDraft === true) {
          throw new Error('Document is in draft mode');
        }

        response.document = {
          _id: rootDoc._id.toString(),
          slug: rootDoc.slug,
          title: rootDoc.title,
          type: route.type,
          path: route.path,  // NEW: Include route path for URL construction
          content: rootDoc.content,  // HTML output with H1 anchor IDs
          description: rootDoc.description,
          tags: rootDoc.tags || [],
          isDraft: rootDoc.isDraft || false,
          draftNotes: rootDoc.draftNotes
        };

        // Check if root document has children
        const childrenWithDepth = await this.fetchChildDocuments(rootDoc._id);
        const hasChildren = childrenWithDepth.length > 0;

        // Fetch root document chunks
        const db = mongoose.connection.db;
        if (!db) {
          throw new Error('Database connection not available');
        }

        const rootChunks = await db.collection('documentchunks').find({
          documentId: rootDoc._id,
          isActive: true
        }).sort({ order: 1 }).toArray();

        // If no children, return root chunks only (current behavior)
        if (!hasChildren) {
          response.sections = rootChunks.map((chunk: any) => ({
            _id: chunk._id.toString(),
            documentId: chunk.documentId.toString(),
            title: chunk.title,
            slug: chunk.slug,
            content: this.convertPlainTextToHTML(chunk.content, chunk.headingLevel),
            order: chunk.order,
            depth: 0  // Root level
          }));

          response.hasChildren = false;
          return response;
        }

        // Has children → Build hierarchical structure with route info
        const hierarchicalChildren = await this.buildHierarchicalChildren(
          rootDoc._id,
          route.path,
          route.type,
          0,
          5
        );

        // Check if ANY children have routes (at any depth)
        const hasAnyChildWithRoute = (children: any[]): boolean => {
          return children.some(child => child.hasRoute || hasAnyChildWithRoute(child.children || []));
        };

        // If children have routes → show root content + hierarchical TOC
        if (hasAnyChildWithRoute(hierarchicalChildren)) {
          // Return root document content only
          response.sections = rootChunks.map((chunk: any) => ({
            _id: chunk._id.toString(),
            documentId: chunk.documentId.toString(),
            title: chunk.title,
            slug: chunk.slug,
            content: this.convertPlainTextToHTML(chunk.content, chunk.headingLevel),
            order: chunk.order,
            depth: 0
          }));

          response.hasChildren = false; // Don't assemble sections hierarchy
          response.childDocuments = hierarchicalChildren; // NEW: Hierarchical TOC data

          return response;
        }

        // Children don't have routes → Assemble full hierarchy
        const allSections: any[] = [];

        // Add root document chunks (depth 0)
        rootChunks.forEach((chunk: any) => {
          allSections.push({
            _id: chunk._id.toString(),
            documentId: chunk.documentId.toString(),
            title: chunk.title,
            slug: chunk.slug,
            content: this.convertPlainTextToHTML(chunk.content, chunk.headingLevel),
            order: chunk.order,
            depth: 0,
            isRootChunk: true
          });
        });

        // Add child documents with proper heading level adjustment
        for (const { document: childDoc, depth, order } of childrenWithDepth) {
          // Fetch child document chunks
          const childChunks = await db.collection('documentchunks').find({
            documentId: childDoc._id,
            isActive: true
          }).sort({ order: 1 }).toArray();

          // Add child document title as section heading
          allSections.push({
            _id: childDoc._id.toString(),
            documentId: childDoc._id.toString(),
            title: childDoc.title,
            slug: childDoc.slug,
            content: `<h${depth + 1}>${childDoc.title}</h${depth + 1}>`,
            order: order,
            depth: depth,
            isDocumentTitle: true  // Flag for frontend to identify document boundaries
          });

          // Add child document chunks with adjusted heading levels
          childChunks.forEach((chunk: any, chunkIndex: number) => {
            allSections.push({
              _id: chunk._id.toString(),
              documentId: chunk.documentId.toString(),
              title: chunk.title,
              slug: chunk.slug,
              content: this.convertPlainTextToHTML(
                chunk.content,
                chunk.headingLevel + depth  // Adjust heading level based on depth
              ),
              order: order + (chunkIndex * 0.01),  // Maintain order within parent
              depth: depth,
              parentDocumentId: childDoc._id.toString()
            });
          });
        }

        // Sort sections by order
        allSections.sort((a, b) => a.order - b.order);

        response.sections = allSections;
        response.hasChildren = true;

        // Add child documents metadata for TOC generation
        response.childDocuments = childrenWithDepth.map(({ document: childDoc, depth }) => ({
          _id: childDoc._id.toString(),
          slug: childDoc.slug,
          title: childDoc.title,
          hasRoute: false,  // These children don't have routes (assembled mode)
          depth: depth,
          order: childDoc.order,
          children: []  // Flat list in assembled mode
        }));

        return response;
      }

      if (route.kind === 'category') {
        // Categories don't have sections, just metadata
        response.document = {
          _id: route._id.toString(),
          slug: urlPath.split('/').pop() || urlPath,
          title: route.title,
          type: route.type,
          path: route.path,  // NEW: Include route path
          description: route.description,
          tags: [],
          isDraft: false,
          draftNotes: undefined
        };

        // Sections are empty for categories
        response.sections = [];

        // Find all enabled sub-routes under this category
        const subRoutes = await Route.find({
          type,
          path: { $regex: `^${urlPath}/` },  // Starts with "category/"
          kind: 'document',                   // Only document routes in listing
          enabled: true                        // ⚠️ Only enabled routes
        }).sort({ title: 1 });

        response.subRoutes = subRoutes.map(subRoute => ({
          path: subRoute.path,
          title: subRoute.title,
          description: subRoute.description,
          isPublic: subRoute.isPublic
        }));

        return response;
      }

      throw new Error('Invalid route kind');

    } catch (error: any) {
      logger.error(`DocumentService.getByPath error: ${error.message}`, { type, urlPath });
      throw error;
    }
  }

  /**
   * Convert plain text chunk content to HTML
   * Simple conversion: paragraphs separated by double newlines
   *
   * @param content - Plain text content from chunk
   * @param headingLevel - H2 or H3 level for the section heading
   * @returns HTML string
   */
  private static convertPlainTextToHTML(content: string, headingLevel: number): string {
    if (!content || !content.trim()) {
      return '<p>Contenuto non disponibile.</p>';
    }

    const lines = content.trim().split('\n');
    const htmlParts: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Check if this is a list item (starts with bullet or number)
      if (line.trim().match(/^[•\-\*]\s+/) || line.trim().match(/^\d+[\.\)]\s+/)) {
        // Start of a list - collect all consecutive list items
        const listItems: string[] = [];
        const isBullet = line.trim().match(/^[•\-\*]\s+/);

        while (i < lines.length && (lines[i].trim().match(/^[•\-\*]\s+/) || lines[i].trim().match(/^\d+[\.\)]\s+/))) {
          const itemText = lines[i].trim()
            .replace(/^[•\-\*]\s+/, '')  // Remove bullet
            .replace(/^\d+[\.\)]\s+/, ''); // Remove number

          // Escape HTML
          const escaped = itemText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

          listItems.push(`<li>${escaped}</li>`);
          i++;
        }

        // Wrap in ul or ol
        const listTag = isBullet ? 'ul' : 'ol';
        htmlParts.push(`<${listTag}>\n${listItems.join('\n')}\n</${listTag}>`);
      } else if (line.trim()) {
        // Regular paragraph
        const escaped = line.trim()
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');

        htmlParts.push(`<p>${escaped}</p>`);
        i++;
      } else {
        // Empty line - skip
        i++;
      }
    }

    return htmlParts.join('\n');
  }

  /**
   * Find similar route using vector search (typo-tolerant routing)
   *
   * Used as fallback when route not found - searches for semantically similar routes
   * and suggests redirect if match is good enough.
   *
   * @param type - Route type to filter by
   * @param searchPath - The path that was not found (e.g., "folgore")
   * @param minSimilarity - Minimum similarity threshold (default 0.7)
   * @returns Similar route info or null if no good match
   */
  static async findSimilarRoute(
    type: 'ambientazione' | 'approfondimenti' | 'regolamento',
    searchPath: string,
    minSimilarity: number = 0.55  // Threshold for typo tolerance (55% similarity)
  ): Promise<{ type: string; path: string; similarity: number } | null> {
    try {
      // Generate embedding for search path
      const embeddingRes = await fetch(`${EMBEDDINGS_SERVICE_URL}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: searchPath }),
        signal: AbortSignal.timeout(5000)
      });

      if (!embeddingRes.ok) {
        logger.error(`Embeddings service error: ${embeddingRes.status}`);
        return null;
      }

      const embeddingData = await embeddingRes.json() as { success: boolean; embedding?: number[] };

      if (!embeddingData.success || !embeddingData.embedding) {
        logger.error('Failed to generate embedding for similar route search');
        return null;
      }

      // Vector search in Qdrant with type and kind filters
      const searchResults = await qdrant.search(ROUTES_COLLECTION, {
        vector: embeddingData.embedding,
        limit: 1,
        score_threshold: minSimilarity,
        filter: {
          must: [
            { key: 'type', match: { value: type } },
            { key: 'kind', match: { value: 'document' } }  // Only redirect to documents, not categories
          ]
        }
      });

      if (searchResults.length === 0) {
        return null;
      }

      const match = searchResults[0];
      logger.info(`Vector fallback: "${searchPath}" → "${match.payload?.path}" (similarity: ${match.score.toFixed(2)})`);

      return {
        type: match.payload?.type as string,
        path: match.payload?.path as string,
        similarity: match.score
      };

    } catch (error: any) {
      logger.error(`Error in findSimilarRoute: ${error.message}`);
      return null;
    }
  }
}
