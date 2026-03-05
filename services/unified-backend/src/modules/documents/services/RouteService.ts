/**
 * RouteService
 *
 * Service for route resolution and document retrieval using dual-table architecture.
 * Handles Route→Document resolution with redirect support.
 */

import mongoose from 'mongoose';
import Route from '@database/models/Route';
import Document from '@database/models/Document';
import { logger } from '@shared/utils/logger';
import { HierarchyService } from './HierarchyService';
import { EmbeddingService } from './EmbeddingService';

export interface RouteWithDocument {
  route: {
    path: string;
    type: 'ambientazione' | 'approfondimenti' | 'regolamento';
    kind: 'document' | 'category' | 'redirect';
    title?: string;
    description?: string;
    isPublic: boolean;
    enabled: boolean;
    redirectTo?: string;
  };
  document?: {
    _id: string;
    slug: string;
    title?: string;
    type: 'ambientazione' | 'approfondimenti' | 'regolamento';
    path: string;
    content?: string;
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
    content: string;
    order: number;
    depth?: number;
    isDocumentTitle?: boolean;
    isRootChunk?: boolean;
    parentDocumentId?: string;
  }>;
  subRoutes?: Array<{
    path: string;
    title?: string;
    description?: string;
    isPublic: boolean;
  }>;
  hasChildren?: boolean;
  childDocuments?: Array<{
    _id: string;
    slug: string;
    title: string;
    hasRoute: boolean;
    routePath?: string;
    depth: number;
    order: number;
    children: any[];
  }>;
}

export class RouteService {
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
        enabled: true
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
        return response;
      }

      if (route.kind === 'document') {
        return await this.handleDocumentRoute(route, response);
      }

      if (route.kind === 'category') {
        return await this.handleCategoryRoute(route, response, type, urlPath);
      }

      throw new Error('Invalid route kind');

    } catch (error: any) {
      logger.error(`RouteService.getByPath error: ${error.message}`, { type, urlPath });
      throw error;
    }
  }

  /**
   * Handle document route - fetch root document + children + chunks
   */
  private static async handleDocumentRoute(
    route: any,
    response: RouteWithDocument
  ): Promise<RouteWithDocument> {
    if (!route.rootDocumentId) {
      throw new Error('Document route missing rootDocumentId');
    }

    const rootDoc = await Document.findById(route.rootDocumentId);
    if (!rootDoc) {
      throw new Error('Root document not found');
    }

    // Filter by visibility and draft status
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
      path: route.path,
      content: rootDoc.content,
      description: rootDoc.description,
      tags: rootDoc.tags || [],
      isDraft: rootDoc.isDraft || false,
      draftNotes: rootDoc.draftNotes
    };

    // Check if root document has children
    const childrenWithDepth = await HierarchyService.fetchChildDocuments(rootDoc._id);
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

    // If no children, return root chunks only
    if (!hasChildren) {
      response.sections = rootChunks.map((chunk: any) => ({
        _id: chunk._id.toString(),
        documentId: chunk.documentId.toString(),
        title: chunk.title,
        slug: chunk.slug,
        content: this.convertPlainTextToHTML(chunk.content, chunk.headingLevel),
        order: chunk.order,
        depth: 0
      }));

      response.hasChildren = false;
      return response;
    }

    // Has children → Build hierarchical structure with route info
    const hierarchicalChildren = await HierarchyService.buildHierarchicalChildren(
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
      response.sections = rootChunks.map((chunk: any) => ({
        _id: chunk._id.toString(),
        documentId: chunk.documentId.toString(),
        title: chunk.title,
        slug: chunk.slug,
        content: this.convertPlainTextToHTML(chunk.content, chunk.headingLevel),
        order: chunk.order,
        depth: 0
      }));

      response.hasChildren = false;
      response.childDocuments = hierarchicalChildren;

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
        isDocumentTitle: true
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
            chunk.headingLevel + depth
          ),
          order: order + (chunkIndex * 0.01),
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
      hasRoute: false,
      depth: depth,
      order: childDoc.order,
      children: []
    }));

    return response;
  }

  /**
   * Handle category route - list sub-routes
   */
  private static async handleCategoryRoute(
    route: any,
    response: RouteWithDocument,
    type: string,
    urlPath: string
  ): Promise<RouteWithDocument> {
    // Categories don't have sections, just metadata
    response.document = {
      _id: route._id.toString(),
      slug: urlPath.split('/').pop() || urlPath,
      type: route.type,
      path: route.path,
      tags: [],
      isDraft: false,
      draftNotes: undefined
    };

    response.sections = [];

    // Find all enabled sub-routes under this category
    const subRoutes = await Route.find({
      type,
      path: { $regex: `^${urlPath}/` },
      kind: 'document',
      enabled: true
    }).sort({ title: 1 });

    response.subRoutes = subRoutes.map(subRoute => ({
      path: subRoute.path,
      isPublic: subRoute.isPublic
    }));

    return response;
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
            .replace(/^[•\-\*]\s+/, '')
            .replace(/^\d+[\.\)]\s+/, '');

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
   * @param minSimilarity - Minimum similarity threshold (default 0.55)
   * @returns Similar route info or null if no good match
   */
  static async findSimilarRoute(
    type: 'ambientazione' | 'approfondimenti' | 'regolamento',
    searchPath: string,
    minSimilarity: number = 0.55
  ): Promise<{ type: string; path: string; similarity: number } | null> {
    try {
      const similarRoute = await EmbeddingService.findSimilarRoute(
        type,
        searchPath,
        minSimilarity
      );

      if (similarRoute) {
        logger.info(`Vector fallback: "${searchPath}" → "${similarRoute.path}" (similarity: ${similarRoute.similarity.toFixed(2)})`);
      }

      return similarRoute;

    } catch (error: any) {
      logger.error(`Error in findSimilarRoute: ${error.message}`);
      return null;
    }
  }
}
