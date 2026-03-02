import { db } from '@database/models';
import { Document as MongooseDocument } from 'mongoose';

// Access mongoose from the centralized connection
const mongoose = db.getMongoose();
const Schema = mongoose.Schema;
const model = mongoose.model.bind(mongoose);

// Document Group Interface - Represents logical grouping of documents
export interface IDocumentGroup extends MongooseDocument {
  name: string;
  description?: string;
  type: 'ambientazione' | 'regolamento';
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Document Interface - Matches the existing structure from game-backend
export interface IDocument extends MongooseDocument {
  uniqueId?: string;
  slug: string;
  title: string;
  description?: string;
  content: string;
  groupId?: string; // Reference to DocumentGroup
  group?: string; // Legacy field for compatibility
  type: 'ambientazione' | 'regolamento';
  visibility: 'pubblico' | 'ristretto' | 'spento';
  status: 'draft' | 'published' | 'archived' | 'deleted';
  order: number;
  tags?: string[];
  summary?: string;
  
  // Publishing fields
  isPublic: boolean; // Legacy compatibility
  activeVersion: number;
  totalSections: number;
  lastUpdated: Date;
  publishedAt?: Date;
  
  // Author fields
  authorId: string;
  authorName: string;
  createdBy: {
    userId: string;
    username: string;
  };
  lastEditedBy?: string;
  version: number;
  
  // Embeddings for semantic search
  contentEmbedding?: number[]; // 384-dimensional vector from sentence-transformers
  embeddingModel?: string; // Model used to generate embedding
  embeddingGeneratedAt?: Date; // When embedding was generated

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Document Group Schema
const DocumentGroupSchema = new Schema<IDocumentGroup>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  type: {
    type: String,
    required: true,
    enum: ['ambientazione', 'regolamento']
  },
  order: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'document_groups'
});

// Document Schema - Extended for management
const DocumentSchema = new Schema<IDocument>({
  uniqueId: {
    type: String,
    unique: true,
    sparse: true
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  content: {
    type: String,
    required: true
  },
  groupId: {
    type: String,
    ref: 'DocumentGroup'
  },
  group: {
    type: String, // Legacy compatibility
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['ambientazione', 'regolamento']
  },
  visibility: {
    type: String,
    required: true,
    enum: ['pubblico', 'ristretto', 'spento'],
    default: 'pubblico'
  },
  status: {
    type: String,
    required: true,
    enum: ['draft', 'published', 'archived', 'deleted'],
    default: 'published'
  },
  order: {
    type: Number,
    default: 0,
    min: 0
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  summary: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Publishing fields for compatibility
  isPublic: {
    type: Boolean,
    default: true
  },
  activeVersion: {
    type: Number,
    default: 1,
    min: 1
  },
  totalSections: {
    type: Number,
    default: 1,
    min: 1
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  publishedAt: Date,
  
  // Author fields
  authorId: {
    type: String,
    required: true
  },
  authorName: {
    type: String,
    required: true,
    trim: true
  },
  createdBy: {
    userId: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true,
      trim: true
    }
  },
  lastEditedBy: {
    type: String,
    trim: true
  },
  version: {
    type: Number,
    default: 1,
    min: 1
  },

  // Embeddings for semantic search
  contentEmbedding: {
    type: [Number],
    required: false,
    validate: {
      validator: function(v: number[]) {
        // Validate 384-dimensional vector (or empty)
        return !v || v.length === 0 || v.length === 384;
      },
      message: 'contentEmbedding must be a 384-dimensional vector'
    }
  },
  embeddingModel: {
    type: String,
    trim: true,
    default: 'paraphrase-multilingual-MiniLM-L12-v2'
  },
  embeddingGeneratedAt: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'documents'
});

// Indexes for Document Groups
DocumentGroupSchema.index({ type: 1, order: 1 });
DocumentGroupSchema.index({ type: 1, isActive: 1 });
DocumentGroupSchema.index({ name: 1, type: 1 }, { unique: true });

// Indexes for Documents
DocumentSchema.index({ type: 1, groupId: 1, order: 1 });
DocumentSchema.index({ type: 1, slug: 1 }, { unique: true });
DocumentSchema.index({ status: 1, visibility: 1 });
DocumentSchema.index({ authorId: 1 });
DocumentSchema.index({ 'createdBy.userId': 1 });
DocumentSchema.index({ tags: 1 });

// Virtual to get group information
DocumentSchema.virtual('groupInfo', {
  ref: 'DocumentGroup',
  localField: 'groupId',
  foreignField: '_id',
  justOne: true
});

// Methods for Document Groups
DocumentGroupSchema.methods.toSafeObject = function() {
  const group = this.toObject();
  return {
    id: group._id.toString(),
    name: group.name,
    description: group.description,
    type: group.type,
    order: group.order,
    isActive: group.isActive,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt
  };
};

// Methods for Documents
DocumentSchema.methods.toSafeObject = function() {
  const doc = this.toObject();
  return {
    id: doc._id.toString(),
    title: doc.title,
    content: doc.content,
    groupId: doc.groupId,
    group: doc.group,
    type: doc.type,
    visibility: doc.visibility,
    status: doc.status,
    order: doc.order,
    slug: doc.slug,
    summary: doc.summary,
    tags: doc.tags,
    authorId: doc.authorId,
    authorName: doc.authorName,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    publishedAt: doc.publishedAt,
    lastEditedBy: doc.lastEditedBy,
    version: doc.version
  };
};

// Check if user can access document based on visibility
DocumentSchema.methods.canAccess = function(user: any) {
  if (this.visibility === 'pubblico') return true;
  if (this.visibility === 'spento') return false;
  if (this.visibility === 'ristretto') {
    // Restricted documents require authentication
    return !!user;
  }
  return false;
};

export const DocumentGroup = mongoose.models.DocumentGroup || model<IDocumentGroup>('DocumentGroup', DocumentGroupSchema);
export const DocumentModel = mongoose.models.Document || model<IDocument>('Document', DocumentSchema);