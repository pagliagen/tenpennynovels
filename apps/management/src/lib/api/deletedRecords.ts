/**
 * API client for Deleted Records
 */

import { apiClient } from './client';
import type {
  DeletedRecordsParams,
  DeletedRecordsResponse,
  RecordType,
  RestoreRecordData,
  RestoreRecordResponse,
  PermanentDeleteData,
  BulkPermanentDeleteData,
  BulkPermanentDeleteResponse
} from '@/types/api/DeletedRecord';
import type { ApiResponse } from '@/types/api/common';

/**
 * Get deleted records
 */
export async function getDeletedRecords(
  params: DeletedRecordsParams = {}
): Promise<DeletedRecordsResponse> {
  const response = await apiClient.get<ApiResponse<DeletedRecordsResponse>>(
    '/admin/deleted-records',
    { params }
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch deleted records');
  }

  return response.data.data;
}

/**
 * Restore a deleted record
 */
export async function restoreRecord(
  id: string,
  data: RestoreRecordData
): Promise<RestoreRecordResponse> {
  try {
    const response = await apiClient.post<ApiResponse<RestoreRecordResponse>>(
      `/admin/deleted-records/${id}/restore`,
      data
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to restore record');
    }

    return response.data.data;
  } catch (error: any) {
    // Handle KEY_CONFLICT errors (409 status)
    if (error.response?.status === 409 && error.response?.data?.code === 'KEY_CONFLICT') {
      const conflictError: any = new Error(error.response.data.error || 'Key conflicts detected');
      conflictError.code = 'KEY_CONFLICT';
      conflictError.data = error.response.data.data;
      throw conflictError;
    }
    throw error;
  }
}

/**
 * Permanently delete a record (hard delete)
 */
export async function permanentlyDelete(
  id: string,
  data: PermanentDeleteData
): Promise<void> {
  const response = await apiClient.delete<ApiResponse<void>>(
    `/admin/deleted-records/${id}`,
    { data }
  );

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to permanently delete record');
  }
}

/**
 * Bulk permanent delete
 */
export async function bulkPermanentlyDelete(
  data: BulkPermanentDeleteData
): Promise<BulkPermanentDeleteResponse> {
  const response = await apiClient.post<ApiResponse<BulkPermanentDeleteResponse>>(
    '/admin/deleted-records/bulk-permanent-delete',
    data
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to bulk permanently delete');
  }

  return response.data.data;
}
