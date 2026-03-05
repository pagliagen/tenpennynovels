/**
 * DeletedRecordsService
 *
 * Centralized service for managing soft deleted records across all models.
 *
 * Features:
 * - Aggregate deleted records from User, Character, Document, Location, Item
 * - Check key conflicts before restore
 * - Transactional restore with validation
 * - Permanent delete with 30-day retention policy
 */

import mongoose, { Model } from 'mongoose';
import { User } from '@database/models/User';
import { Character } from '@database/models/Character';
import Document from '@database/models/Document';
import { Location } from '@database/models/Location';
import { Item } from '@database/models/Item';

export type RecordType = 'user' | 'character' | 'document' | 'location' | 'item';

export interface DeletedRecord {
  _id: string;
  type: RecordType;
  displayName: string;
  originalKeys: Record<string, any>;
  keyConflicts?: Record<string, boolean>;
  deletedAt: Date;
  deletedBy: {
    _id?: string;
    username: string;
  };
  metadata?: {
    relatedRecords?: Array<{ type: string; id: string; name: string }>;
  };
}

export interface DeletedRecordsParams {
  type?: RecordType;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DeletedRecordsResponse {
  items: DeletedRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  counts: {
    user: number;
    character: number;
    document: number;
    location: number;
    item: number;
    total: number;
  };
}

export class DeletedRecordsService {
  /**
   * Get deleted records from all models or specific type
   */
  async getDeletedRecords(params: DeletedRecordsParams = {}): Promise<DeletedRecordsResponse> {
    const {
      type,
      page = 1,
      pageSize = 25,
      sortBy = 'deletedAt',
      sortOrder = 'desc'
    } = params;

    const skip = (page - 1) * pageSize;
    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    let items: DeletedRecord[] = [];

    // If specific type requested, query only that model
    if (type) {
      items = await this.queryModelDeleted(type, skip, pageSize, sort);
    } else {
      // Query all models and merge results
      const [users, characters, documents, locations, itemRecords] = await Promise.all([
        this.queryModelDeleted('user', 0, pageSize * 5, sort),
        this.queryModelDeleted('character', 0, pageSize * 5, sort),
        this.queryModelDeleted('document', 0, pageSize * 5, sort),
        this.queryModelDeleted('location', 0, pageSize * 5, sort),
        this.queryModelDeleted('item', 0, pageSize * 5, sort)
      ]);

      // Merge and sort all results
      items = [...users, ...characters, ...documents, ...locations, ...itemRecords]
        .sort((a, b) => {
          const aVal = a[sortBy as keyof DeletedRecord];
          const bVal = b[sortBy as keyof DeletedRecord];
          if (aVal === undefined || bVal === undefined) return 0;
          if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        })
        .slice(skip, skip + pageSize);
    }

    // Get counts
    const counts = await this.getCounts();

    // Calculate pagination
    const totalItems = type ? counts[type] : counts.total;
    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      counts
    };
  }

  /**
   * Query deleted records from specific model
   */
  private async queryModelDeleted(
    type: RecordType,
    skip: number,
    limit: number,
    sort: any
  ): Promise<DeletedRecord[]> {
    const Model = this.getModelByType(type);

    const docs = await Model.find({ deletedAt: { $exists: true } })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    return docs.map((doc: any) => ({
      _id: doc._id.toString(),
      type,
      displayName: this.getDisplayName(type, doc),
      originalKeys: doc.originalKeys || {},
      deletedAt: doc.deletedAt,
      deletedBy: {
        _id: doc.deletedBy?.toString(),
        username: doc.deletedByName || 'Unknown'
      }
    }));
  }

  /**
   * Get display name for deleted record based on type
   */
  private getDisplayName(type: RecordType, doc: any): string {
    switch (type) {
      case 'user':
        return doc.originalKeys?.username || doc.username || 'Unknown User';
      case 'character':
        return doc.originalKeys?.name || doc.name || 'Unknown Character';
      case 'document':
        return doc.title || doc.originalKeys?.slug || doc.slug || 'Unknown Document';
      case 'location':
        return doc.name || doc.originalKeys?.slug || doc.slug || 'Unknown Location';
      case 'item':
        return doc.originalKeys?.name || doc.name || 'Unknown Item';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get counts of deleted records by type
   */
  async getCounts(): Promise<DeletedRecordsResponse['counts']> {
    const [userCount, charCount, docCount, locCount, itemCount] = await Promise.all([
      User.countDocuments({ deletedAt: { $exists: true } }),
      Character.countDocuments({ deletedAt: { $exists: true } }),
      Document.countDocuments({ deletedAt: { $exists: true } }),
      Location.countDocuments({ deletedAt: { $exists: true } }),
      Item.countDocuments({ deletedAt: { $exists: true } })
    ]);

    return {
      user: userCount,
      character: charCount,
      document: docCount,
      location: locCount,
      item: itemCount,
      total: userCount + charCount + docCount + locCount + itemCount
    };
  }

  /**
   * Check if originalKeys are still available (not taken by another record)
   */
  async checkKeyConflicts(
    recordId: string,
    type: RecordType
  ): Promise<Record<string, boolean>> {
    const Model = this.getModelByType(type);

    // Find the deleted record
    const record = await Model.findById(recordId)
      .setOptions({ _includeDeleted: true });

    if (!record || !record.deletedAt) {
      throw new Error('Record not found or not soft deleted');
    }

    const conflicts: Record<string, boolean> = {};

    // Check each original key
    for (const [key, value] of Object.entries(record.originalKeys || {})) {
      // Check if another non-deleted record has this key
      const existing = await Model.findOne({
        [key]: value,
        deletedAt: { $exists: false },
        _id: { $ne: recordId }
      });

      conflicts[key] = !!existing;
    }

    return conflicts;
  }

  /**
   * Restore deleted record (transactional)
   *
   * @param recordId - ID of record to restore
   * @param type - Type of record
   * @param newKeys - Optional new keys if originals are taken (e.g., { username: 'newusername' })
   */
  async restoreRecord(
    recordId: string,
    type: RecordType,
    newKeys?: Record<string, string>
  ): Promise<{ success: boolean; conflicts?: Record<string, boolean> }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const Model = this.getModelByType(type);

      // Find record with session
      const record = await Model.findById(recordId)
        .session(session)
        .setOptions({ _includeDeleted: true });

      if (!record) {
        throw new Error('Record not found');
      }

      if (!record.deletedAt) {
        throw new Error('Record is not soft deleted');
      }

      // If newKeys provided, use them instead of originalKeys
      if (newKeys) {
        // Validate newKeys are available
        for (const [key, value] of Object.entries(newKeys)) {
          const existing = await Model.findOne({
            [key]: value,
            deletedAt: { $exists: false },
            _id: { $ne: recordId }
          }).session(session);

          if (existing) {
            await session.abortTransaction();
            return {
              success: false,
              conflicts: { [key]: true }
            };
          }

          // Set new key value
          record[key] = value;
        }

        // Clear originalKeys since we're using new values
        record.originalKeys = undefined;
        record.deletedAt = undefined;
        record.deletedBy = undefined;
        record.deletedByName = undefined;
        record.deletedByType = undefined;

        await record.save({ session });
      } else {
        // Use built-in restore method from plugin
        const result = await record.restore();

        if (!result.success) {
          await session.abortTransaction();
          return result;
        }
      }

      await session.commitTransaction();
      return { success: true };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Permanently delete record (hard delete)
   *
   * RETENTION POLICY: Only allowed if deletedAt > 30 days ago
   */
  async permanentDelete(recordId: string, type: RecordType): Promise<void> {
    const Model = this.getModelByType(type);

    // Find record
    const record = await Model.findById(recordId)
      .setOptions({ _includeDeleted: true });

    if (!record) {
      throw new Error('Record not found');
    }

    if (!record.deletedAt) {
      throw new Error('Record is not soft deleted');
    }

    // RETENTION POLICY: 30 days
    const daysSinceDeleted = (Date.now() - record.deletedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceDeleted < 30) {
      throw new Error(
        `Cannot permanently delete: retention policy requires 30 days. ` +
        `Record was deleted ${Math.floor(daysSinceDeleted)} days ago.`
      );
    }

    // Hard delete
    await Model.findByIdAndDelete(recordId);
  }

  /**
   * Bulk permanent delete (with retention check)
   */
  async bulkPermanentDelete(
    recordIds: string[],
    type: RecordType
  ): Promise<{ success: number; failed: number; errors: Array<{ id: string; error: string }> }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>
    };

    for (const id of recordIds) {
      try {
        await this.permanentDelete(id, type);
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          id,
          error: error.message || 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Get model class by type
   */
  private getModelByType(type: RecordType): Model<any> {
    const models: Record<RecordType, Model<any>> = {
      user: User as any,
      character: Character as any,
      document: Document as any,
      location: Location as any,
      item: Item as any
    };

    const model = models[type];
    if (!model) {
      throw new Error(`Invalid record type: ${type}`);
    }

    return model;
  }
}
