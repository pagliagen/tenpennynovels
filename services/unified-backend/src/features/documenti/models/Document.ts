/**
 * Document Model (Content + Routing Layer)
 *
 * Single source of truth for document content and URL resolution.
 * Supports hierarchy (parent/child relationships) for granular embedding/search.
 * Grouped by DocumentSubtype for sidebar navigation.
 *
 * URL resolution: Document.findOne({ type, path }) where path = "{subtype.slug}/{doc.slug}"
 */

import mongoose, { Schema, Document as MongooseDocument, Types } from 'mongoose';
import { softDeletePlugin, SoftDeleteMethods } from '@database/plugins/softDeletePlugin';
import { logger } from '@shared/utils/logger';

export interface IDocument extends MongooseDocument, SoftDeleteMethods {
  // Identity
  slug: string;
  title: string;
  type: 'ambientazione' | 'regolamento';

  // Subtype & Routing
  subtypeId: Types.ObjectId;
  path: string;              // Calculated: "{subtype.slug}/{doc.slug}" (unique per type)
  isPublic: boolean;

  // Content (TipTap Delta JSON - ONLY format)
  contentDelta: any;
  content?: string;          // HTML output (auto-generated from contentDelta with H1 IDs)

  // Hierarchy (for parent/child relationships)
  parentId?: Types.ObjectId;
  order: number;

  // Metadata
  description?: string;
  tags: string[];
  isDraft: boolean;
  draftNotes?: string;
  visible: boolean;

  lastUpdated: Date;
  createdAt: Date;
}

const DocumentSchema = new Schema<IDocument>({
  // Identity
  slug: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['ambientazione', 'regolamento'],
    required: true,
    index: true
  },

  // Subtype & Routing
  subtypeId: {
    type: Schema.Types.ObjectId,
    ref: 'DocumentSubtype',
    required: true,
    index: true
  },
  path: {
    type: String,
    required: false  // Calculated by pre-save hook
  },
  isPublic: {
    type: Boolean,
    default: true
  },

  // Content (TipTap Delta JSON)
  contentDelta: {
    type: Schema.Types.Mixed,
    required: true
  },
  content: {
    type: String,
    required: false
  },

  // Hierarchy
  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'Document',
    required: false,
    index: true
  },
  order: {
    type: Number,
    default: 0
  },

  // Metadata
  description: {
    type: String,
    default: ''
  },
  tags: {
    type: [String],
    default: []
  },
  isDraft: {
    type: Boolean,
    default: false,
    index: true
  },
  draftNotes: {
    type: String
  },
  visible: {
    type: Boolean,
    default: true,
    index: true
  },

  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'documents',
  timestamps: false
});

// ========== HOOKS ==========

/**
 * Pre-save hook: Path calculation, type validation, HTML generation
 */
DocumentSchema.pre('save', async function() {
  // PATH CALCULATION: Calculate path from subtype.slug + doc.slug
  if (this.isNew || this.isModified('subtypeId') || this.isModified('slug')) {
    const DocumentSubtype = (await import('./DocumentSubtype')).default;
    const subtype = await DocumentSubtype.findById(this.subtypeId);

    if (!subtype) {
      throw new Error(`DocumentSubtype ${this.subtypeId} not found`);
    }

    if (subtype.type !== this.type) {
      throw new Error(
        `Document type (${this.type}) must match DocumentSubtype type (${subtype.type})`
      );
    }

    this.path = `${subtype.slug}/${this.slug}`;
  }

  // TYPE VALIDATION: If type changed, validate it still matches subtype
  if (this.isModified('type') && !this.isNew && !this.isModified('subtypeId')) {
    const DocumentSubtype = (await import('./DocumentSubtype')).default;
    const subtype = await DocumentSubtype.findById(this.subtypeId);

    if (subtype && subtype.type !== this.type) {
      throw new Error(
        `Document type (${this.type}) must match DocumentSubtype type (${subtype.type})`
      );
    }
  }

  // HTML GENERATION: Generate HTML content from contentDelta
  if (this.isModified('contentDelta')) {
    try {
      const { generateHtml } = await import('../services/HtmlGenerator');
      this.content = generateHtml(this.contentDelta, { injectHeadingIds: true });
    } catch (error) {
      logger.error('[Document] Failed to generate HTML from contentDelta:', error);
    }
    // Flag for post-save SEO description generation
    (this as any)._seoTrigger = true;
  }

  // SEO / sitemap: bump lastUpdated when public-facing fields change (not order/parentId alone)
  if (!this.isNew) {
    const bumpsLastUpdated = [
      'title',
      'contentDelta',
      'slug',
      'type',
      'subtypeId',
      'isPublic',
      'visible',
      'isDraft',
      'tags',
      'draftNotes',
    ];
    if (bumpsLastUpdated.some((field) => this.isModified(field))) {
      this.lastUpdated = new Date();
    }
  }
});

/**
 * Post-save hook: Trigger embedding generation or cleanup + SEO description generation
 */
DocumentSchema.post('save', async function(doc) {
  try {
    const { publishDocumentEvent } = await import('@shared/services/EmbeddingEventPublisher');

    const action = doc.isNew ? 'created' : 'updated';
    await publishDocumentEvent(action, {
      _id: doc._id.toString(),
      title: doc.title,
      content: doc.content || '',
      type: doc.type
    });
  } catch (error) {
    logger.error('[Document] Failed to publish embedding event:', error);
  }

  // Fire-and-forget SEO description generation when content changed
  if ((doc as any)._seoTrigger && doc.content) {
    const { SeoDescriptionService } = await import('../services/SeoDescriptionService');
    SeoDescriptionService.generateAndSave(doc._id.toString(), doc.title, doc.content);
  }
});

/**
 * Post-delete hooks: Trigger embedding cleanup
 */
DocumentSchema.post('deleteOne', async function(doc) {
  try {
    const { publishDocumentDeletedEvent } = await import('@shared/services/EmbeddingEventPublisher');
    await publishDocumentDeletedEvent(doc._id.toString());
  } catch (error) {
    logger.error('[Document] Failed to publish delete event:', error);
  }
});

DocumentSchema.post('findOneAndDelete', async function(doc) {
  if (!doc) return;
  try {
    const { publishDocumentDeletedEvent } = await import('@shared/services/EmbeddingEventPublisher');
    await publishDocumentDeletedEvent(doc._id.toString());
  } catch (error) {
    logger.error('[Document] Failed to publish delete event:', error);
  }
});

// ========== INDEXES ==========

// URL resolution: find document by type + calculated path
DocumentSchema.index({ type: 1, path: 1 }, { unique: true });

// Hierarchy queries (fast children fetch)
DocumentSchema.index({ parentId: 1, order: 1 });

// Subtype grouping (list documents by subtype, ordered)
DocumentSchema.index({ subtypeId: 1, order: 1 });

// Tag-based search
DocumentSchema.index({ tags: 1 });

// Full-text search (for search endpoint)
DocumentSchema.index({ title: 'text', content: 'text' });

// Apply soft delete plugin
DocumentSchema.plugin(softDeletePlugin, {
  uniqueKeys: ['slug'],
  deletedByField: 'Character'
});

export default mongoose.model<IDocument>('Document', DocumentSchema);
