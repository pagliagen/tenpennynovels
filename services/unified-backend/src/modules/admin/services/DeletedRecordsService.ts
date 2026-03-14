/**
 * DeletedRecordsService
 *
 * Manages soft-deleted records stored in the `deleted_records` collection.
 * All deleted records live in a single collection, queryable by originalCollection.
 */

import mongoose from 'mongoose';
import { DeletedRecord, IDeletedRecord } from '@database/models/DeletedRecord';
import { getModelForCollection, getRegisteredCollections } from '@database/plugins/softDeleteRegistry';

export type RecordType = string;

export interface DeletedRecordDTO {
  _id: string;
  type: string;
  displayName: string;
  originalKeys: Record<string, any>;
  deletedAt: Date;
  deletedBy: {
    _id?: string;
    username: string;
  };
  deletionReason?: string;
}

export interface DeletedRecordsParams {
  type?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DeletedRecordsResponse {
  items: DeletedRecordDTO[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  counts: Record<string, number> & { total: number };
}

export class DeletedRecordsService {
  async getDeletedRecords(params: DeletedRecordsParams = {}): Promise<DeletedRecordsResponse> {
    const {
      type,
      page = 1,
      pageSize = 25,
      sortBy = 'deletedAt',
      sortOrder = 'desc'
    } = params;

    const filter: any = {};
    if (type) {
      filter.originalCollection = type;
    }

    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (page - 1) * pageSize;

    const [items, totalItems] = await Promise.all([
      DeletedRecord.find(filter).sort(sort).skip(skip).limit(pageSize).lean(),
      DeletedRecord.countDocuments(filter)
    ]);

    const counts = await this.getCounts();
    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      items: items.map((doc: any) => ({
        _id: doc._id.toString(),
        type: doc.originalCollection,
        displayName: doc.displayName,
        originalKeys: doc.originalKeys || {},
        deletedAt: doc.deletedAt,
        deletedBy: {
          _id: doc.deletedBy?.toString(),
          username: doc.deletedByName || 'Unknown'
        },
        deletionReason: doc.deletionReason
      })),
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

  async getCounts(): Promise<Record<string, number> & { total: number }> {
    const pipeline = await DeletedRecord.aggregate([
      { $group: { _id: '$originalCollection', count: { $sum: 1 } } }
    ]);

    const counts: any = { total: 0 };
    for (const entry of pipeline) {
      counts[entry._id] = entry.count;
      counts.total += entry.count;
    }

    return counts;
  }

  async checkKeyConflicts(
    recordId: string
  ): Promise<Record<string, boolean>> {
    const record = await DeletedRecord.findById(recordId).lean();
    if (!record) {
      throw new Error('Deleted record not found');
    }

    const Model = getModelForCollection(record.originalCollection);
    if (!Model) {
      throw new Error(`No model registered for collection: ${record.originalCollection}`);
    }

    const conflicts: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(record.originalKeys || {})) {
      const existing = await Model.findOne({ [key]: value });
      conflicts[key] = !!existing;
    }

    return conflicts;
  }

  async restoreRecord(
    recordId: string,
    newKeys?: Record<string, string>
  ): Promise<{ success: boolean; conflicts?: Record<string, boolean> }> {
    const record = await DeletedRecord.findById(recordId) as IDeletedRecord | null;
    if (!record) {
      throw new Error('Deleted record not found');
    }

    const Model = getModelForCollection(record.originalCollection);
    if (!Model) {
      throw new Error(`No model registered for collection: ${record.originalCollection}`);
    }

    const docData = { ...record.data } as Record<string, unknown>;

    if (newKeys) {
      for (const [key, value] of Object.entries(newKeys)) {
        const existing = await Model.findOne({ [key]: value, _id: { $ne: record.originalId } });
        if (existing) {
          return { success: false, conflicts: { [key]: true } };
        }
        docData[key] = value;
      }
    } else {
      for (const [key, value] of Object.entries(record.originalKeys || {})) {
        const existing = await Model.findOne({ [key]: value, _id: { $ne: record.originalId } });
        if (existing) {
          return { success: false, conflicts: { [key]: true } };
        }
        docData[key] = value;
      }
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Model.collection.insertOne(docData, { session });
        await DeletedRecord.findByIdAndDelete(recordId).session(session);
      });

      return { success: true };
    } finally {
      await session.endSession();
    }
  }

  async permanentDelete(recordId: string): Promise<void> {
    const record = await DeletedRecord.findById(recordId);
    if (!record) {
      throw new Error('Deleted record not found');
    }

    const daysSinceDeleted = (Date.now() - record.deletedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDeleted < 30) {
      throw new Error(
        `Cannot permanently delete: retention policy requires 30 days. ` +
        `Record was deleted ${Math.floor(daysSinceDeleted)} days ago.`
      );
    }

    await DeletedRecord.findByIdAndDelete(recordId);
  }

  async bulkPermanentDelete(
    recordIds: string[]
  ): Promise<{ success: number; failed: number; errors: Array<{ id: string; error: string }> }> {
    const results = { success: 0, failed: 0, errors: [] as Array<{ id: string; error: string }> };

    for (const id of recordIds) {
      try {
        await this.permanentDelete(id);
        results.success++;
      } catch (error: unknown) {
        results.failed++;
        results.errors.push({ id, error: error instanceof Error ? error.message : 'Errore sconosciuto' });
      }
    }

    return results;
  }
}
