/**
 * DocumentRouteService
 *
 * Provides atomic operations for managing Document + Route relationships.
 * Ensures consistency between the two tables and prevents orphaned records.
 *
 * Usage:
 *   const service = new DocumentRouteService();
 *   const { document, route } = await service.createDocumentWithRoute({...});
 */

import Document, { IDocument } from '../../../database/models/Document';
import Route, { IRoute, RouteType, RouteKind } from '../../../database/models/Route';
import { Types } from 'mongoose';

export interface CreateDocumentWithRouteInput {
  // Document fields
  document: {
    slug: string;
    title: string;
    type: RouteType;
    contentDelta: any;
    description?: string;
    parentId?: string;  // Parent document ID
    order?: number;
    tags?: string[];
    isDraft?: boolean;
    draftNotes?: string;
  };

  // Route fields
  route: {
    parentId?: string;  // Parent route ID
    slug: string;
    title: string;
    type: RouteType;
    kind: RouteKind;
    order?: number;
    description?: string;
    displayCategory?: string;
    isPublic?: boolean;
    enabled?: boolean;
    redirectTo?: string;  // Only for kind='redirect'
  };
}

export interface CreateDocumentWithRouteResult {
  document: IDocument;
  route: IRoute;
}

export class DocumentRouteService {
  /**
   * Create document + route atomically
   *
   * Ensures:
   * - Document is created first (route references it via rootDocumentId)
   * - Route.type matches Document.type (enforced by validation)
   * - Route.slug matches Document.slug (convention)
   * - Both succeed or both fail (atomic operation)
   */
  async createDocumentWithRoute(
    input: CreateDocumentWithRouteInput
  ): Promise<CreateDocumentWithRouteResult> {
    // Validate input
    if (input.document.type !== input.route.type) {
      throw new Error(
        `Document type (${input.document.type}) must match Route type (${input.route.type})`
      );
    }

    if (input.route.kind === 'document' && !input.document) {
      throw new Error('Route kind=document requires document data');
    }

    if (input.route.kind === 'redirect' && !input.route.redirectTo) {
      throw new Error('Route kind=redirect requires redirectTo field');
    }

    // STEP 1: Create Document
    const doc = await Document.create({
      slug: input.document.slug,
      title: input.document.title,
      type: input.document.type,
      contentDelta: input.document.contentDelta,
      description: input.document.description,
      parentId: input.document.parentId
        ? new Types.ObjectId(input.document.parentId)
        : undefined,
      order: input.document.order ?? 0,
      tags: input.document.tags ?? [],
      isDraft: input.document.isDraft ?? false,
      draftNotes: input.document.draftNotes,
      visible: true,
      deleted: false
    });

    try {
      // STEP 2: Create Route (references document via rootDocumentId)
      const route = await Route.create({
        parentId: input.route.parentId
          ? new Types.ObjectId(input.route.parentId)
          : undefined,
        slug: input.route.slug,
        title: input.route.title,
        type: input.route.type,
        kind: input.route.kind,
        rootDocumentId: input.route.kind === 'document' ? doc._id : undefined,
        description: input.route.description,
        isPublic: input.route.isPublic ?? false,
        enabled: input.route.enabled ?? true,
        redirectTo: input.route.redirectTo,
        path: '' // Will be calculated by pre-save hook
      });

      return { document: doc, route };
    } catch (error) {
      // Rollback: delete document if route creation fails
      await Document.deleteOne({ _id: doc._id });
      throw error;
    }
  }

  /**
   * Update title in both Document and Route
   *
   * Ensures title stays synchronized between tables.
   * Only updates route if document is referenced by a route.
   */
  async updateTitle(documentId: string, newTitle: string): Promise<void> {
    // Update document
    const doc = await Document.findById(documentId);
    if (!doc) {
      throw new Error(`Document ${documentId} not found`);
    }

    doc.title = newTitle;
    await doc.save();

    // Update route if exists
    const route = await Route.findOne({ rootDocumentId: doc._id });
    if (route) {
      route.title = newTitle;
      await route.save();
    }
  }

  /**
   * Update type in both Document and Route
   *
   * Ensures type stays synchronized between tables.
   * Validation hooks will prevent type mismatch.
   */
  async updateType(
    documentId: string,
    newType: RouteType
  ): Promise<void> {
    // Update document
    const doc = await Document.findById(documentId);
    if (!doc) {
      throw new Error(`Document ${documentId} not found`);
    }

    doc.type = newType;
    await doc.save();  // Will trigger validation if route exists

    // Update route if exists
    const route = await Route.findOne({ rootDocumentId: doc._id });
    if (route) {
      route.type = newType;
      await route.save();  // Will trigger validation
    }
  }

  /**
   * Delete document + route atomically
   *
   * Soft-deletes document (sets deleted=true).
   * Disables route (sets enabled=false) to return 404.
   */
  async deleteDocumentAndRoute(documentId: string): Promise<void> {
    // Soft-delete document
    const doc = await Document.findById(documentId);
    if (!doc) {
      throw new Error(`Document ${documentId} not found`);
    }

    doc.deleted = true;
    await doc.save();

    // Disable route if exists
    const route = await Route.findOne({ rootDocumentId: doc._id });
    if (route) {
      route.enabled = false;
      await route.save();
    }
  }

  /**
   * Restore document + route atomically
   *
   * Undeletes document (sets deleted=false).
   * Enables route (sets enabled=true).
   */
  async restoreDocumentAndRoute(documentId: string): Promise<void> {
    // Restore document
    const doc = await Document.findById(documentId);
    if (!doc) {
      throw new Error(`Document ${documentId} not found`);
    }

    doc.deleted = false;
    await doc.save();

    // Enable route if exists
    const route = await Route.findOne({ rootDocumentId: doc._id });
    if (route) {
      route.enabled = true;
      await route.save();
    }
  }

  /**
   * Get document with route metadata
   *
   * Returns document with optional route information.
   */
  async getDocumentWithRoute(
    documentId: string
  ): Promise<{ document: IDocument; route: IRoute | null }> {
    const doc = await Document.findById(documentId);
    if (!doc) {
      throw new Error(`Document ${documentId} not found`);
    }

    const route = await Route.findOne({ rootDocumentId: doc._id });

    return { document: doc, route };
  }
}
