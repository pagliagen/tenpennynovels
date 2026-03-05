/**
 * Types for Deleted Records API
 */

export type RecordType = 'user' | 'character' | 'document' | 'location' | 'item';

export interface DeletedRecord {
  _id: string;
  type: RecordType;
  displayName: string;
  originalKeys: Record<string, string>;
  keyConflicts?: Record<string, boolean>;
  deletedAt: string;
  deletedBy: {
    _id?: string;
    username: string;
  };
  metadata?: {
    relatedRecords?: Array<{
      type: string;
      id: string;
      name: string;
    }>;
  };
}

export interface DeletedRecordsParams {
  page?: number;
  pageSize?: number;
  type?: RecordType;
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

export interface RestoreRecordData {
  type: RecordType;
  newKeys?: Record<string, string>;
}

export interface RestoreRecordResponse {
  restored: boolean;
  recordId: string;
  type: RecordType;
}

export interface PermanentDeleteData {
  type: RecordType;
}

export interface BulkPermanentDeleteData {
  type: RecordType;
  ids: string[];
}

export interface BulkPermanentDeleteResponse {
  success: number;
  failed: number;
  errors: Array<{
    id: string;
    error: string;
  }>;
}
