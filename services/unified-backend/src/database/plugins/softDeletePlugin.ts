/**
 * Mongoose Soft Delete Plugin
 *
 * Provides consistent soft delete functionality across all models.
 *
 * Features:
 * - Soft delete with key mangling (frees unique constraints)
 * - originalKeys snapshot for restore
 * - Auto-filtering of deleted records in queries
 * - Restore with conflict validation
 * - Audit trail (deletedAt, deletedBy, deletedByName)
 *
 * @module database/plugins/softDeletePlugin
 */

import { Schema, Model, Document, Types } from 'mongoose';

/**
 * Plugin options
 */
export interface SoftDeleteOptions {
  /**
   * Fields with unique constraints that should be mangled on soft delete
   * Example: ['username', 'email'] for User model
   */
  uniqueKeys?: string[];

  /**
   * Type of the deletedBy reference
   * 'Character' for admin actions, 'User' for user actions
   */
  deletedByField: 'Character' | 'User';
}

/**
 * Fields added by plugin
 */
export interface SoftDeleteFields {
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  deletedByName?: string;
  originalKeys?: Record<string, any>;
}

/**
 * Instance methods added by plugin
 */
export interface SoftDeleteMethods {
  /**
   * Soft delete the document
   * - Sets deletedAt, deletedBy, deletedByName
   * - Mangles unique keys (appends suffix to free constraint)
   * - Saves originalKeys for restore
   */
  softDelete(deletedById: Types.ObjectId, deletedByName: string): Promise<void>;

  /**
   * Restore soft deleted document
   * - Validates originalKeys are still available
   * - Returns conflicts if keys are taken
   * - Restores originalKeys on success
   */
  restore(): Promise<{ success: boolean; conflicts?: Record<string, boolean> }>;

  /**
   * Check if document is soft deleted
   */
  isDeleted(): boolean;
}

/**
 * Query helpers added by plugin
 */
export interface SoftDeleteQueryHelpers<T> {
  /**
   * Exclude soft deleted documents (default behavior)
   */
  excludeDeleted(): T;

  /**
   * Include only soft deleted documents
   */
  onlyDeleted(): T;

  /**
   * Include both deleted and non-deleted documents
   */
  withDeleted(): T;
}

/**
 * Soft Delete Plugin
 */
export function softDeletePlugin<T extends Document>(
  schema: Schema<T>,
  options: SoftDeleteOptions
): void {
  // 1. Add soft delete fields to schema
  schema.add({
    deletedAt: {
      type: Date,
      index: true,
      required: false
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      refPath: 'deletedByType',
      required: false
    },
    deletedByName: {
      type: String,
      required: false
    },
    deletedByType: {
      type: String,
      enum: ['Character', 'User'],
      default: options.deletedByField,
      required: false
    },
    originalKeys: {
      type: Schema.Types.Mixed,
      required: false
    }
  } as any);

  // 2. Add instance methods

  /**
   * Soft delete implementation
   */
  schema.methods.softDelete = async function(
    deletedById: Types.ObjectId,
    deletedByName: string
  ): Promise<void> {
    const doc = this;

    // Generate unique suffix for key mangling
    const randomSuffix = `_deleted_${doc._id}_${Date.now()}`;
    const originalKeys: Record<string, any> = {};

    // Mangle unique keys to free constraints
    for (const key of options.uniqueKeys || []) {
      if (doc[key] !== undefined && doc[key] !== null) {
        // Save original value
        originalKeys[key] = doc[key];

        // Mangle key (append suffix)
        doc[key] = `${doc[key]}${randomSuffix}`;
      }
    }

    // Set soft delete fields
    doc.deletedAt = new Date();
    doc.deletedBy = deletedById;
    doc.deletedByName = deletedByName;
    doc.deletedByType = options.deletedByField;
    doc.originalKeys = originalKeys;

    // Save document
    await doc.save();
  };

  /**
   * Restore implementation with conflict validation
   */
  schema.methods.restore = async function(): Promise<{
    success: boolean;
    conflicts?: Record<string, boolean>;
  }> {
    const doc = this;

    // Check if document is soft deleted
    if (!doc.deletedAt) {
      throw new Error('Document is not soft deleted');
    }

    // Get model for conflict checks
    const Model = doc.constructor as Model<any>;

    // Check if originalKeys are still available
    const conflicts: Record<string, boolean> = {};

    for (const [key, value] of Object.entries(doc.originalKeys || {})) {
      // Check if another non-deleted document has this key
      const existing = await Model.findOne({
        [key]: value,
        deletedAt: { $exists: false },
        _id: { $ne: doc._id }
      });

      if (existing) {
        conflicts[key] = true;
      }
    }

    // If conflicts exist, return them
    if (Object.keys(conflicts).length > 0) {
      return { success: false, conflicts };
    }

    // Restore originalKeys
    for (const [key, value] of Object.entries(doc.originalKeys || {})) {
      doc[key] = value;
    }

    // Clear soft delete fields
    doc.deletedAt = undefined;
    doc.deletedBy = undefined;
    doc.deletedByName = undefined;
    doc.deletedByType = undefined;
    doc.originalKeys = undefined;

    // Save document
    await doc.save();

    return { success: true };
  };

  /**
   * Check if deleted
   */
  schema.methods.isDeleted = function(): boolean {
    return !!this.deletedAt;
  };

  // 3. Add query helpers

  (schema.query as any).excludeDeleted = function(this: any) {
    return this.where({ deletedAt: { $exists: false } });
  };

  (schema.query as any).onlyDeleted = function(this: any) {
    return this.where({ deletedAt: { $exists: true } });
  };

  (schema.query as any).withDeleted = function(this: any) {
    this.setOptions({ _includeDeleted: true });
    return this;
  };

  // 4. Add query middleware to auto-filter deleted records

  /**
   * Pre-find middleware: auto-exclude deleted unless .withDeleted() is used
   */
  const queryTypesToFilter = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'findOneAndReplace',
    'count',
    'countDocuments',
    'estimatedDocumentCount'
  ];

  queryTypesToFilter.forEach((queryType) => {
    schema.pre(queryType as any, function() {
      const query = this as any;

      // If query doesn't have _includeDeleted flag, add filter
      if (!query.getOptions()._includeDeleted) {
        // Don't override if deletedAt is already in query
        const queryConditions = query.getQuery();
        if (!queryConditions.deletedAt) {
          query.where({ deletedAt: { $exists: false } });
        }
      }
    });
  });

  /**
   * Pre-aggregate middleware: prepend $match stage to exclude deleted
   */
  schema.pre('aggregate', function() {
    const aggregation = this as any;

    // If aggregate doesn't have _includeDeleted flag, prepend $match
    if (!aggregation.options._includeDeleted) {
      const pipeline = aggregation.pipeline();

      // Check if first stage already filters deletedAt
      const firstStage = pipeline[0];
      const hasDeletedAtFilter =
        firstStage &&
        firstStage.$match &&
        firstStage.$match.deletedAt !== undefined;

      // If not, prepend filter
      if (!hasDeletedAtFilter) {
        pipeline.unshift({ $match: { deletedAt: { $exists: false } } });
      }
    }
  });

  // 5. Add static methods for bulk operations

  /**
   * Find documents including soft deleted
   */
  schema.statics.findWithDeleted = function(conditions: any) {
    return this.find(conditions).setOptions({ _includeDeleted: true });
  };

  /**
   * Find only soft deleted documents
   */
  schema.statics.findOnlyDeleted = function(conditions: any = {}) {
    return this.find({ ...conditions, deletedAt: { $exists: true } });
  };

  /**
   * Count soft deleted documents
   */
  schema.statics.countDeleted = function(conditions: any = {}) {
    return this.countDocuments({ ...conditions, deletedAt: { $exists: true } });
  };

  /**
   * Restore document by ID
   * Shortcut for findById + restore()
   */
  schema.statics.restoreById = async function(id: string | Types.ObjectId) {
    const doc = await this.findById(id).setOptions({ _includeDeleted: true });

    if (!doc) {
      throw new Error('Document not found');
    }

    return doc.restore();
  };
}

/**
 * Type augmentation for models using soft delete plugin
 */
export interface SoftDeleteModel<T extends Document> extends Model<T> {
  /**
   * Find documents including soft deleted
   */
  findWithDeleted(conditions?: any): any;

  /**
   * Find only soft deleted documents
   */
  findOnlyDeleted(conditions?: any): any;

  /**
   * Count soft deleted documents
   */
  countDeleted(conditions?: any): Promise<number>;

  /**
   * Restore document by ID
   */
  restoreById(id: string | Types.ObjectId): Promise<{
    success: boolean;
    conflicts?: Record<string, boolean>;
  }>;
}
