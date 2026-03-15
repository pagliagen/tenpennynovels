import { Request, Response } from 'express';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '../utils/apiResponse';

import type { PaginationInfo } from '../types/management';

export class ModerationAlertController {
  /**
   * GET /admin/moderation/alerts
   */
  static async getAlerts(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const source = req.query.source as string;
      const status = req.query.status as string;
      const characterId = req.query.characterId as string;
      const minScore = parseFloat(req.query.minScore as string);
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

      const { ModerationAlert } = await import('@database/models');

      const query: any = {};
      if (source && ['chat', 'forum'].includes(source)) {
        query.source = source;
      }
      if (status && ['pending', 'reviewed', 'dismissed', 'actioned'].includes(status)) {
        query.status = status;
      }
      if (characterId) {
        query.characterId = characterId;
      }
      if (!isNaN(minScore)) {
        query.toxicityScore = { $gte: minScore };
      }
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = dateFrom;
        if (dateTo) query.createdAt.$lte = dateTo;
      }

      const skip = (page - 1) * limit;
      const [alerts, totalCount] = await Promise.all([
        ModerationAlert.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        ModerationAlert.countDocuments(query)
      ]);

      const pagination: PaginationInfo = {
        page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        pageSize: limit,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed moderation alerts', { ...auditInfo, filters: { source, status, characterId, minScore } });

      res.json({ success: true, list: alerts, pagination: pagination });
    } catch (error: any) {
      logger.error('Error fetching moderation alerts:', { error: error?.message });
      res.status(500).json({ success: false, error: 'Errore nel recupero degli alert di moderazione', code: 'FETCH_ALERTS_ERROR' });
    }
  }

  /**
   * GET /admin/moderation/alerts/stats
   */
  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const source = req.query.source as string;
      const { ModerationAlert } = await import('@database/models');

      const baseQuery: any = {};
      if (source && ['chat', 'forum'].includes(source)) {
        baseQuery.source = source;
      }

      const [pending, reviewed, dismissed, actioned] = await Promise.all([
        ModerationAlert.countDocuments({ ...baseQuery, status: 'pending' }),
        ModerationAlert.countDocuments({ ...baseQuery, status: 'reviewed' }),
        ModerationAlert.countDocuments({ ...baseQuery, status: 'dismissed' }),
        ModerationAlert.countDocuments({ ...baseQuery, status: 'actioned' })
      ]);

      res.json(successResponse({ pending, reviewed, dismissed, actioned, total: pending + reviewed + dismissed + actioned }, undefined, getRequestId(req)));
    } catch (error: any) {
      logger.error('Error fetching moderation stats:', { error: error?.message });
      res.status(500).json({ success: false, error: 'Errore nel recupero delle statistiche', code: 'FETCH_STATS_ERROR' });
    }
  }

  /**
   * GET /admin/moderation/alerts/:id
   */
  static async getAlertById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { ModerationAlert } = await import('@database/models');

      const alert = await ModerationAlert.findById(id).lean();
      if (!alert) {
        res.status(404).json({ success: false, error: 'Alert non trovato', code: 'ALERT_NOT_FOUND' });
        return;
      }

      res.json({ success: true, data: alert });
    } catch (error: any) {
      logger.error('Error fetching moderation alert:', { error: error?.message });
      res.status(500).json(errorResponse('Errore nel recupero dell\'alert', 'FETCH_ALERT_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  /**
   * PATCH /admin/moderation/alerts/:id/review
   */
  static async reviewAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status, reviewNotes, actionTaken } = req.body;

      if (!status || !['reviewed', 'dismissed', 'actioned'].includes(status)) {
        res.status(400).json({ success: false, error: 'Status non valido (reviewed, dismissed, actioned)', code: 'INVALID_STATUS' });
        return;
      }

      const { ModerationAlert } = await import('@database/models');
      const userId = req.user?.userId || 'unknown';

      const alert = await ModerationAlert.findByIdAndUpdate(
        id,
        {
          $set: {
            status,
            reviewedBy: userId,
            reviewedAt: new Date(),
            reviewNotes: reviewNotes || undefined,
            actionTaken: actionTaken || undefined
          }
        },
        { new: true }
      ).lean();

      if (!alert) {
        res.status(404).json({ success: false, error: 'Alert non trovato', code: 'ALERT_NOT_FOUND' });
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin reviewed moderation alert', { ...auditInfo, alertId: id, status, actionTaken });

      res.json(updateResponse({ message: 'Alert aggiornato con successo', alert }, undefined, getRequestId(req)));
    } catch (error: any) {
      logger.error('Error reviewing moderation alert:', { error: error?.message });
      res.status(500).json(errorResponse('Errore nell\'aggiornamento dell\'alert', 'REVIEW_ALERT_ERROR', undefined, 500, getRequestId(req)));
    }
  }
}
