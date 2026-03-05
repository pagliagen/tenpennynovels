/**
 * Document Model (Content Layer)
 *
 * Represents the content of a document. Routing is managed by Route model.
 * Supports hierarchy (parent/child relationships) for granular embedding/search.
 */

import mongoose, { Schema, Document as MongooseDocument, Types } from 'mongoose';
import { softDeletePlugin, SoftDeleteFields, SoftDeleteMethods } from '../plugins/softDeletePlugin';

export interface IDocument extends MongooseDocument, SoftDeleteFields, SoftDeleteMethods {
  // Identity
  slug: string;              // Unique identifier (e.g., "folklore", "upper-class")
  title: string;
  type: 'ambientazione' | 'approfondimenti' | 'regolamento';  // Document type (determines which section it belongs to)

  // Content (TipTap Delta JSON - ONLY format)
  contentDelta: any;         // TipTap JSON Delta (WYSIWYG gestionale format)
  content?: string;          // HTML output (auto-generated from contentDelta with H1 IDs)
  description?: string;

  // Hierarchy (for parent/child relationships)
  parentId?: Types.ObjectId; // Reference to parent document (null if root)
  order: number;             // Order for assembly in parent (1, 2, 3...)

  // Metadata
  tags: string[];            // Tags for semantic search
  isDraft: boolean;          // If true, content is incomplete/work-in-progress
  draftNotes?: string;       // Notes/instructions for drafts
  visible: boolean;          // If false, document is hidden (admin can still see it)

  lastUpdated: Date;
  createdAt: Date;
}

const DocumentSchema = new Schema<IDocument>({
  // Identity
  slug: {
    type: String,
    required: true,
    unique: true, // Ensure slug uniqueness
    index: true
  },
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['ambientazione', 'approfondimenti', 'regolamento'],
    required: true,
    index: true
  },

  // Content (TipTap Delta JSON)
  contentDelta: {
    type: Schema.Types.Mixed,
    required: true
  },
  content: {
    type: String,
    required: false            // Auto-generated from contentDelta in pre-save hook
  },
  description: {
    type: String
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
  // REMOVED: deleted field (now using soft delete plugin)

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
  timestamps: false // We manage timestamps manually
});

// ========== HOOKS ==========

/**
 * Pre-save hook: Validations + HTML generation
 */
DocumentSchema.pre('save', async function() {
  // VALIDATION: If document is referenced by a route, validate type matches
  // Skip validation for new documents (routes may not exist yet, e.g., during seeding)
  if (this.isModified('type') && !this.isNew) {
    // Dynamic import to avoid circular dependencies
    const Route = (await import('./Route')).default;
    const route = await Route.findOne({ rootDocumentId: this._id });

    if (route && route.type !== this.type) {
      throw new Error(
        `Document type (${this.type}) must match Route type (${route.type}). ` +
        `Route ${route._id} has type="${route.type}"`
      );
    }
  }

  // HTML GENERATION: Generate HTML content from contentDelta
  if (this.isModified('contentDelta')) {
    try {
      // Dynamic import to avoid circular dependencies
      const { generateHtml } = await import('../../modules/admin/services/HtmlGenerator');
      this.content = generateHtml(this.contentDelta, { injectHeadingIds: true });
    } catch (error) {
      console.error('[Document] Failed to generate HTML from contentDelta:', error);
      // Don't block save - content will be undefined, can be regenerated later
    }
  }
});

/**
 * Post-save hook: Trigger embedding generation or cleanup
 * Handles: create, update, soft delete, restore
 */
DocumentSchema.post('save', async function(doc) {
  try {
    const { publishDocumentEvent, publishDocumentDeletedEvent } = await import('@shared/services/EmbeddingEventPublisher');

    // SOFT DELETE: If deletedAt is set, clean up embeddings
    if (doc.deletedAt) {
      await publishDocumentDeletedEvent(doc._id.toString());
      return;
    }

    // CREATE/UPDATE/RESTORE: Generate embeddings
    const action = doc.isNew ? 'created' : 'updated';
    await publishDocumentEvent(action, {
      _id: doc._id.toString(),
      title: doc.title,
      content: doc.content || '',
      type: doc.type
    });
  } catch (error) {
    console.error('[Document] Failed to publish embedding event:', error);
    // Don't block save - embeddings can be regenerated later
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
    console.error('[Document] Failed to publish delete event:', error);
  }
});

DocumentSchema.post('findOneAndDelete', async function(doc) {
  if (!doc) return;
  try {
    const { publishDocumentDeletedEvent } = await import('@shared/services/EmbeddingEventPublisher');
    await publishDocumentDeletedEvent(doc._id.toString());
  } catch (error) {
    console.error('[Document] Failed to publish delete event:', error);
  }
});

// ========== INDEXES ==========

// Index for hierarchy queries (fast children fetch)
DocumentSchema.index({ parentId: 1, order: 1 });

// Index for slug lookup (admin/search)
DocumentSchema.index({ slug: 1 });

// Index for tag-based search
DocumentSchema.index({ tags: 1 });

// Apply soft delete plugin
DocumentSchema.plugin(softDeletePlugin, {
  uniqueKeys: ['slug'],
  deletedByField: 'Character'
});

export default mongoose.model<IDocument>('Document', DocumentSchema);
