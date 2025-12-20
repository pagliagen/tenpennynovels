import mongoose, { Schema, model, Document as MongooseDocument } from 'mongoose';

export interface IDocument extends MongooseDocument {
  // Basic info
  slug: string;
  title: string;
  description: string;
  content: string;

  // Organization
  groupId: Schema.Types.ObjectId;
  group: string;
  type: 'ambientazione' | 'regolamento' | 'lore';

  // Visibility and status
  visibility: 'public' | 'private' | 'restricted';
  status: 'draft' | 'published' | 'archived';
  isPublic: boolean;

  // Ordering and metadata
  order: number;
  tags: string[];
  summary: string;

  // Versioning
  activeVersion: number;
  version: number;
  totalSections: number;

  // Author and editing info
  authorId: string;
  authorName: string;
  createdBy: {
    userId: string;
    username: string;
  };
  lastEditedBy: string;

  // Timestamps
  lastUpdated: Date;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Embeddings for semantic search
  contentEmbedding?: number[];
  embeddingModel?: string;
  embeddingGeneratedAt?: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      index: true
    },
    description: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    groupId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true
    },
    group: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['ambientazione', 'regolamento', 'lore'],
      required: true,
      index: true
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'restricted'],
      default: 'public'
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true
    },
    isPublic: {
      type: Boolean,
      default: true,
      index: true
    },
    order: {
      type: Number,
      default: 0
    },
    tags: {
      type: [String],
      default: []
    },
    summary: {
      type: String,
      default: ''
    },
    activeVersion: {
      type: Number,
      default: 1
    },
    version: {
      type: Number,
      default: 1
    },
    totalSections: {
      type: Number,
      default: 0
    },
    authorId: {
      type: String,
      required: true
    },
    authorName: {
      type: String,
      required: true
    },
    createdBy: {
      userId: { type: String, required: true },
      username: { type: String, required: true }
    },
    lastEditedBy: {
      type: String,
      required: true
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    publishedAt: {
      type: Date
    },
    contentEmbedding: {
      type: [Number],
      required: false,
      validate: {
        validator: function (v: number[]) {
          return !v || v.length === 0 || v.length === 384;
        },
        message: 'Embedding must be 384 dimensions'
      }
    },
    embeddingModel: {
      type: String,
      required: false
    },
    embeddingGeneratedAt: {
      type: Date,
      required: false
    }
  },
  {
    timestamps: true,
    collection: 'documents'
  }
);

// Indexes for search and filtering
DocumentSchema.index({ type: 1, status: 1, isPublic: 1 });
DocumentSchema.index({ group: 1, order: 1 });
DocumentSchema.index({ tags: 1 });
DocumentSchema.index({ title: 'text', content: 'text' });

export default model<IDocument>('Document', DocumentSchema);
