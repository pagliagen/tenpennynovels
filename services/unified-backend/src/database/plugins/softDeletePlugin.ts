/**
 * Mongoose Soft Delete Plugin (move-to-archive)
 *
 * Instead of marking records as deleted in their own collection,
 * this plugin moves them to a dedicated `deleted_records` collection
 * and hard-deletes them from the original collection.
 *
 * Features:
 * - Atomic move-to-archive via MongoDB transactions
 * - Full JSON snapshot of the deleted document
 * - Unique key tracking for conflict checking on restore
 * - Audit trail (deletedAt, deletedBy, deletedByName)
 *
 * @module database/plugins/softDeletePlugin
 */

import mongoose, { Schema, Model, Document, Types } from 'mongoose';
import { getDisplayNameField } from './softDeleteRegistry';

/**
 * Plugin options
 */
export interface SoftDeleteOptions {
  uniqueKeys?: string[];
  deletedByField: 'Character' | 'User';
}

/**
 * Instance methods added by plugin
 */
export interface SoftDeleteMethods {
  softDelete(deletedById: Types.ObjectId, deletedByName: string, reason?: string): Promise<void>;
}

/**
 * Soft Delete Plugin
 */
export function softDeletePlugin(
  schema: Schema<any>,
  options: SoftDeleteOptions
): void {
  schema.methods.softDelete = async function(
    deletedById: Types.ObjectId,
    deletedByName: string,
    reason?: string
  ): Promise<void> {
    const doc = this;
    const ModelConstructor = doc.constructor as Model<any>;
    const collectionName = ModelConstructor.collection.collectionName;

    const snapshot = doc.toObject({ virtuals: false, depopulate: true });
    delete snapshot.__v;

    const originalKeys: Record<string, any> = {};
    for (const key of options.uniqueKeys || []) {
      if (snapshot[key] !== undefined && snapshot[key] !== null) {
        originalKeys[key] = snapshot[key];
      }
    }

    const displayNameField = getDisplayNameField(collectionName);
    const displayName = String(snapshot[displayNameField] || snapshot.name || snapshot.title || snapshot.label || 'Unknown');

    const DeletedRecord = mongoose.model('DeletedRecord');

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await DeletedRecord.create([{
          originalCollection: collectionName,
          originalId: doc._id,
          displayName,
          data: snapshot,
          deletedAt: new Date(),
          deletedBy: deletedById,
          deletedByName,
          deletedByType: options.deletedByField,
          deletionReason: reason,
          originalKeys
        }], { session });

        await ModelConstructor.findByIdAndDelete(doc._id).session(session);
      });
    } finally {
      await session.endSession();
    }
  };
}

/**
 * Type augmentation for models using soft delete plugin
 */
export interface SoftDeleteModel<T extends Document> extends Model<T> {}
