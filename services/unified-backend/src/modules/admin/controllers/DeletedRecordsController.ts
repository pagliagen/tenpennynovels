/**
 * DeletedRecordsController
 *
 * Handles HTTP requests for deleted records management (gestore-only)
 */

import { Request, Response } from 'express';
import { DeletedRecordsService, RecordType } from '../services/DeletedRecordsService';
import { successResponse, errorResponse, getRequestId } from '../utils/apiResponse';
import { logger } from '../utils/logger';

export class DeletedRecordsController {
  /**
   * GET /admin/deleted-records
   *
   * Query params:
   * - type?: 'user' | 'character' | 'document' | 'location' | 'item'
   * - page?: number (default: 1)
   * - pageSize?: number (default: 25)
   * - sortBy?: string (default: 'deletedAt')
   * - sortOrder?: 'asc' | 'desc' (default: 'desc')
   */
  static async getDeletedRecords(req: Request, res: Response): Promise<void> {
    try {
      const { type, page, pageSize, sortBy, sortOrder } = req.query;

      const service = new DeletedRecordsService();

      const result = await service.getDeletedRecords({
        type: type as RecordType | undefined,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
        sortBy: sortBy as string | undefined,
        sortOrder: sortOrder as 'asc' | 'desc' | undefined
      });

      res.json(successResponse(
        result,
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching deleted records:', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json(errorResponse(
        'Failed to fetch deleted records',
        'FETCH_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /admin/deleted-records/:id/restore
   *
   * Body:
   * - type: 'user' | 'character' | 'document' | 'location' | 'item'
   * - newKeys?: { username?: string, email?: string, name?: string, slug?: string }
   */
  static async restoreRecord(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { type, newKeys } = req.body;

      if (!id || typeof id !== 'string' || !type || typeof type !== 'string') {
        res.status(400).json(errorResponse(
          'Missing required fields',
          'INVALID_INPUT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const recordId = id;
      const recordType = type as RecordType;
      const service = new DeletedRecordsService();

      // Pre-check conflicts if no newKeys provided
      if (!newKeys) {
        const conflicts = await service.checkKeyConflicts(recordId, recordType);

        if (Object.values(conflicts).some(hasConflict => hasConflict)) {
          res.status(409).json(errorResponse(
            'Key conflicts detected. Original keys are no longer available.',
            'KEY_CONFLICT',
            { conflicts },
            409,
            getRequestId(req)
          ));
          return;
        }
      }

      // Attempt restore
      const result = await service.restoreRecord(recordId, recordType, newKeys);

      if (!result.success) {
        res.status(409).json(errorResponse(
          'Key conflicts detected',
          'KEY_CONFLICT',
          { conflicts: result.conflicts },
          409,
          getRequestId(req)
        ));
        return;
      }

      logger.info('Record restored', {
        id: recordId,
        type: recordType,
        restoredBy: req.user?.username || 'Unknown',
        usedNewKeys: !!newKeys
      });

      res.json(successResponse(
        { restored: true, recordId, type: recordType },
        'Record restored successfully',
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error restoring record:', {
        error: error.message,
        stack: error.stack,
        recordId: req.params.id,
        type: req.body.type
      });

      res.status(500).json(errorResponse(
        error.message || 'Failed to restore record',
        'RESTORE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * DELETE /admin/deleted-records/:id
   *
   * Permanently delete (hard delete) a soft deleted record.
   * Enforces 30-day retention policy.
   *
   * Body:
   * - type: 'user' | 'character' | 'document' | 'location' | 'item'
   */
  static async permanentDelete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { type } = req.body;

      if (!id || typeof id !== 'string' || !type || typeof type !== 'string') {
        res.status(400).json(errorResponse(
          'Missing required fields',
          'INVALID_INPUT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const recordId = id;
      const recordType = type as RecordType;
      const service = new DeletedRecordsService();

      await service.permanentDelete(recordId, recordType);

      logger.warn('Permanent delete executed', {
        id: recordId,
        type: recordType,
        deletedBy: req.user?.username || 'Unknown',
        requestId: getRequestId(req)
      });

      res.json(successResponse(
        { permanentlyDeleted: true, recordId, type: recordType },
        'Record permanently deleted',
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error permanently deleting record:', {
        error: error.message,
        stack: error.stack,
        recordId: req.params.id,
        type: req.body.type
      });

      // If retention policy error, return 400
      if (error.message.includes('retention policy')) {
        res.status(400).json(errorResponse(
          error.message,
          'RETENTION_POLICY_VIOLATION',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      res.status(500).json(errorResponse(
        error.message || 'Failed to permanently delete record',
        'DELETE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /admin/deleted-records/bulk-permanent-delete
   *
   * Bulk permanent delete with retention checks
   *
   * Body:
   * - type: 'user' | 'character' | 'document' | 'location' | 'item'
   * - ids: string[]
   */
  static async bulkPermanentDelete(req: Request, res: Response): Promise<void> {
    try {
      const { type, ids } = req.body;

      if (!type || !Array.isArray(ids) || ids.length === 0) {
        res.status(400).json(errorResponse(
          'Missing required fields: type, ids (array)',
          'INVALID_INPUT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const service = new DeletedRecordsService();

      const result = await service.bulkPermanentDelete(ids, type);

      logger.warn('Bulk permanent delete executed', {
        type,
        idsCount: ids.length,
        success: result.success,
        failed: result.failed,
        deletedBy: req.user?.username || 'Unknown'
      });

      res.json(successResponse(
        result,
        `Permanently deleted ${result.success} records (${result.failed} failed)`,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error bulk permanently deleting records:', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json(errorResponse(
        error.message || 'Failed to bulk permanently delete records',
        'BULK_DELETE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}
