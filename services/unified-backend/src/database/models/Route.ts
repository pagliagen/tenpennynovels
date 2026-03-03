/**
 * Route Model (NEW DUAL-TABLE ARCHITECTURE + REDIRECTS)
 *
 * Routing layer for document access with redirect support.
 * Separates URL management from content (Document model).
 *
 * Examples:
 *   { path: "folklore", type: "ambientazione", kind: "document", rootDocumentId: ObjectId(...) }
 *   { path: "approfondimenti", type: "ambientazione", kind: "category", rootDocumentId: null }
 *   { path: "cicciobalocco", type: "ambientazione", kind: "redirect", redirectTo: "/ambientazione" }
 */

import { Schema, model, Document as MongooseDocument, Types } from 'mongoose';
import type { IDocument } from './Document';

export type RouteType = 'ambientazione' | 'approfondimenti' | 'regolamento';
export type RouteKind = 'document' | 'category' | 'redirect';

export interface IRoute extends MongooseDocument {
  // Hierarchy
  parentId?: Types.ObjectId; // Reference to parent route (null = root level)
  slug: string;              // URL segment ("armi", "folklore")

  // Routing
  path: string;              // CALCULATED: parent.path + slug ("folklore", "approfondimenti/armi")
  type: RouteType;

  // Link to content
  kind: RouteKind;
  rootDocumentId?: Types.ObjectId; // Reference to root document (null for categories/redirects)
  redirectTo?: string;       // Redirect target (e.g., "/ambientazione/folklore" or "folklore")

  // Metadata
  // ⚠️ DEPRECATED: title, description should come from Document via join (TODO: refactor consumers)
  title?: string;             // DEPRECATED - for backwards compatibility only
  description?: string;       // DEPRECATED - for backwards compatibility only
  isPublic: boolean;
  enabled: boolean;          // If false, route returns 404 (soft delete)

  createdAt: Date;
  updatedAt: Date;
}

const RouteSchema = new Schema<IRoute>(
  {
    parentId: { type: Schema.Types.ObjectId, ref: 'Route' },
    slug: { type: String, required: true },
    path: { type: String, required: false },  // Calculated by pre-save hook
    type: { type: String, enum: ['ambientazione', 'approfondimenti', 'regolamento'], required: true },
    kind: { type: String, enum: ['document', 'category', 'redirect'], required: true },
    rootDocumentId: { type: Schema.Types.ObjectId, ref: 'Document' },
    redirectTo: { type: String },
    // ⚠️ DEPRECATED: For backwards compatibility - TODO: refactor consumers to use Document join
    title: { type: String },
    description: { type: String },
    isPublic: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    collection: 'routes'
  }
);

// ========== INDEXES ==========

// Fast routing lookup
RouteSchema.index({ type: 1, path: 1 }, { unique: true });

// Hierarchical queries (order removed - use Document.order via join)
RouteSchema.index({ parentId: 1 });

// Slug lookups
RouteSchema.index({ slug: 1 });

// Filtering enabled routes
RouteSchema.index({ type: 1, enabled: 1, kind: 1, isPublic: 1 });

// ========== HOOKS ==========

/**
 * Pre-save hook: Calculate path from parent.path + slug
 * Ensures path is always consistent with hierarchy
 */
RouteSchema.pre('save', async function(this: IRoute) {
  // VALIDATION: kind='document' requires rootDocumentId
  if (this.kind === 'document') {
    if (!this.rootDocumentId) {
      throw new Error('Route kind=document requires rootDocumentId');
    }

    // Validate rootDocumentId exists in Document collection
    const Document = this.model('Document');
    const doc = await Document.findById(this.rootDocumentId);
    if (!doc) {
      throw new Error(`Document ${this.rootDocumentId} not found`);
    }

    // Validate type matches between Route and Document (type assertion for IDocument)
    const docData = doc as unknown as IDocument;
    if (this.type !== docData.type) {
      throw new Error(
        `Route type (${this.type}) must match Document type (${docData.type}). ` +
        `Document ${this.rootDocumentId} has type="${docData.type}"`
      );
    }
  }

  // VALIDATION: kind='redirect' requires redirectTo
  if (this.kind === 'redirect' && !this.redirectTo) {
    throw new Error('Route kind=redirect requires redirectTo field');
  }

  // PATH CALCULATION
  // Calculate path for new routes or when parentId/slug changes
  if (this.isNew || this.isModified('parentId') || this.isModified('slug')) {
    if (this.parentId) {
      // Child route: path = parent.path + "/" + slug
      const parent = await this.model('Route').findById(this.parentId) as IRoute | null;
      if (!parent) {
        throw new Error('Parent route not found');
      }
      this.path = `${parent.path}/${this.slug}`;
    } else {
      // Root level route: path = slug
      this.path = this.slug;
    }
  }
});

/**
 * Post-save hook: Cascade path updates to children
 * When parent path changes, all descendants update recursively
 */
RouteSchema.post('save', async function(doc) {
  // Find all direct children
  const children = await this.model('Route').find({ parentId: doc._id }) as IRoute[];

  // Update each child (triggers their pre-save hook, cascading further)
  for (const child of children) {
    child.path = `${doc.path}/${child.slug}`;
    await child.save();
  }
});

// ========== MODEL ==========

const Route = model<IRoute>('Route', RouteSchema);

export default Route;
