/**
 * DeletedRecordsController
 *
 * Handles HTTP requests for deleted records management (gestore-only).
 * All deleted records live in a single `deleted_records` collection.
 */

import { Request, Response } from 'express';
import { DeletedRecordsService } from '../services/DeletedRecordsService';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '../utils/apiResponse';

import { logger } from '../utils/logger';

export class DeletedRecordsController {
  static async getDeletedRecords(req: Request, res: Response): Promise<void> {
    try {
      const { type, page, pageSize, sortBy, sortOrder } = req.query;

      const service = new DeletedRecordsService();

      const result = await service.getDeletedRecords({
        type: type as string | undefined,
        currentPage: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
        sortBy: sortBy as string | undefined,
        sortOrder: sortOrder as 'asc' | 'desc' | undefined
      });

      res.json({ success: true, data: result });
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

  static async restoreRecord(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { newKeys } = req.body;

      if (!id || typeof id !== 'string') {
        res.status(400).json(errorResponse(
          'Missing record ID',
          'INVALID_INPUT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const service = new DeletedRecordsService();

      if (!newKeys) {
        const conflicts = await service.checkKeyConflicts(id);
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

      const result = await service.restoreRecord(id, newKeys);

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
        id,
        restoredBy: req.user?.username || 'Unknown',
        usedNewKeys: !!newKeys
      });

      res.json(successResponse(
        { restored: true, recordId: id },
        'Record restored successfully',
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error restoring record:', {
        error: error.message,
        stack: error.stack,
        recordId: req.params.id
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

  static async permanentDelete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        res.status(400).json(errorResponse(
          'Missing record ID',
          'INVALID_INPUT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const service = new DeletedRecordsService();
      await service.permanentDelete(id);

      logger.warn('Permanent delete executed', {
        id,
        deletedBy: req.user?.username || 'Unknown',
        requestId: getRequestId(req)
      });

      res.json(successResponse(
        { permanentlyDeleted: true, recordId: id },
        'Record permanently deleted',
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error permanently deleting record:', {
        error: error.message,
        stack: error.stack,
        recordId: req.params.id
      });

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

  static async bulkPermanentDelete(req: Request, res: Response): Promise<void> {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json(errorResponse(
          'Missing required field: ids (array)',
          'INVALID_INPUT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const service = new DeletedRecordsService();
      const result = await service.bulkPermanentDelete(ids);

      logger.warn('Bulk permanent delete executed', {
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
