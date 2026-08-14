/**
 * DocumentSubtype Model
 *
 * Represents a grouping category for documents within a type (ambientazione/regolamento).
 * Each subtype has a slug, title, and order for sidebar navigation.
 *
 * Examples:
 *   { slug: "introduzione", title: "Introduzione", type: "ambientazione", order: 0 }
 *   { slug: "londra-1985", title: "Londra 1985", type: "ambientazione", order: 1 }
 *   { slug: "approfondimenti", title: "Approfondimenti", type: "ambientazione", order: 2 }
 */

import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';

export type DocumentType = 'ambientazione' | 'regolamento';

export interface IDocumentSubtype extends MongooseDocument {
  slug: string;
  title: string;
  type: DocumentType;
  order: number;
  expandedByDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSubtypeSchema = new Schema<IDocumentSubtype>(
  {
    slug: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['ambientazione', 'regolamento'],
      required: true
    },
    order: {
      type: Number,
      default: 0
    },
    expandedByDefault: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    collection: 'documentsubtypes'
  }
);

// ========== INDEXES ==========

// Slug unique per type
DocumentSubtypeSchema.index({ type: 1, slug: 1 }, { unique: true });

// Ordinamento per tipo
DocumentSubtypeSchema.index({ type: 1, order: 1 });

export default mongoose.model<IDocumentSubtype>('DocumentSubtype', DocumentSubtypeSchema);
