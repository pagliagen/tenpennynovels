/**
 * DocumentChunk Model
 *
 * Represents semantic chunks (H2 sections + H3 sub-sections) of documents with embeddings.
 * Used for granular semantic search with anchor links.
 *
 * Each Document can have multiple DocumentChunks (H2 + H3 headings).
 * H3 chunks reference their parent H2 via parentSlug for search result linking.
 * Supports soft versioning (isActive flag) for handling heading renames.
 */

import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';

export type DocumentType = 'ambientazione' | 'approfondimenti' | 'regolamento';

export interface IDocumentChunk extends MongooseDocument {
  documentId: mongoose.Types.ObjectId;

  // CHUNK IDENTITY
  slug: string;                    // "le-abitazioni" (anchor ID, human-readable)
  slugHistory: string[];           // ["le-abitazioni", "le-case"] - for redirect OLD → NEW
  title: string;                   // "Le abitazioni" (H2/H3 text)
  headingLevel: 2 | 3;             // H2 (main sections) + H3 (sub-sections)

  // PARENT REFERENCE (for H3 sub-chunks)
  parentChunkId?: mongoose.Types.ObjectId;  // Parent H2 chunk (null for H2)
  parentSlug?: string;             // Parent H2 slug (for linking)

  // CONTENT (normalized to plain text for embeddings)
  content: string;                 // Plain text (Delta → text extraction)
  order: number;                   // Order within document (0, 1, 2...)

  // DOCUMENT TYPE (for filtering in search)
  documentType: DocumentType;      // Copied from parent Document

  // VERSIONING (Soft)
  version: number;                 // 1, 2, 3... (incremented on edit)
  isActive: boolean;               // Only latest version = true

  // EMBEDDINGS
  contentEmbedding?: number[];     // 384D vector (paraphrase-multilingual-MiniLM-L12-v2)
  embeddingModel?: string;         // "paraphrase-multilingual-MiniLM-L12-v2"
  embeddingGeneratedAt?: Date;

  // AUDIT
  createdAt: Date;
  createdBy: {
    userId: string;
    username: string;
  };
  updatedAt?: Date;
  updatedBy?: {
    userId: string;
    username: string;
  };
}

const DocumentChunkSchema = new Schema<IDocumentChunk>({
  documentId: {
    type: Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
    index: true
  },

  // CHUNK IDENTITY
  slug: {
    type: String,
    required: true,
    index: true
  },
  slugHistory: {
    type: [String],
    default: [],
    index: true  // For redirect lookup
  },
  title: {
    type: String,
    required: true
  },
  headingLevel: {
    type: Number,
    enum: [2, 3],
    required: true,
    default: 2
  },

  // PARENT REFERENCE (for H3 sub-chunks)
  parentChunkId: {
    type: Schema.Types.ObjectId,
    ref: 'DocumentChunk',
    required: false,
    index: true
  },
  parentSlug: {
    type: String,
    required: false,
    index: true
  },

  // CONTENT
  content: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    required: true,
    default: 0
  },

  // DOCUMENT TYPE
  documentType: {
    type: String,
    enum: ['ambientazione', 'approfondimenti', 'regolamento'],
    required: true,
    index: true
  },

  // VERSIONING
  version: {
    type: Number,
    required: true,
    default: 1
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true,
    index: true
  },

  // EMBEDDINGS
  contentEmbedding: {
    type: [Number]
  },
  embeddingModel: {
    type: String
  },
  embeddingGeneratedAt: {
    type: Date
  },

  // AUDIT
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    userId: String,
    username: String
  },
  updatedAt: {
    type: Date
  },
  updatedBy: {
    userId: String,
    username: String
  }
}, {
  collection: 'documentChunks',
  timestamps: false // We manage timestamps manually
});

// ========== INDEXES ==========

// Hierarchy queries (fetch all chunks for document, ordered)
DocumentChunkSchema.index({ documentId: 1, order: 1 });

// Slug lookup with type filter (for route resolution + anchor)
DocumentChunkSchema.index({ slug: 1, documentType: 1 });

// Active chunks filtering (for search)
DocumentChunkSchema.index({ isActive: 1, documentType: 1 });

// Document active chunks lookup (for re-chunking diff)
DocumentChunkSchema.index({ documentId: 1, isActive: 1 });

// Index for fetching H3 sub-chunks by parent
DocumentChunkSchema.index({ parentSlug: 1, headingLevel: 1, isActive: 1 });

export default mongoose.model<IDocumentChunk>('DocumentChunk', DocumentChunkSchema);
