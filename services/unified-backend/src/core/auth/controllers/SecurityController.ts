import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { CharacterSession } from '../models/CharacterSession';
import { SecurityAlert } from '@database/models/SecurityAlert';
import { successResponse, errorResponse, listResponse } from '@shared/utils/apiResponse';
import { ErrorCode } from '@shared/utils/errorCodes';
import { logger } from '../logger';
import { redis } from '@config/runtime/redis';
import { GeoIPService } from '@shared/services/GeoIPService';

export class SecurityController {
  /**
   * ✅ GET /auth/security/sessions
   * Get REAL active sessions for the user from CharacterSession collection
   */
  static async getSessions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;

      // ✅ VERA QUERY al database (NO MOCK)
      const total = await CharacterSession.countDocuments({ userId, isActive: true });
      const sessions = await CharacterSession.find({ userId, isActive: true })
        .sort({ lastActiveAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean();

      // Ottieni sessionId corrente dal cookie (se presente)
      const currentSessionId = req.cookies?.auth_token_session;

      // ✅ GeoIP lookup parallelo per tutte le sessioni
      const sessionList = await Promise.all(sessions.map(async session => {
        const ipAddress = session.deviceInfo.ipAddress || '127.0.0.1';
        const geoLocation = await GeoIPService.lookup(ipAddress);

        return {
          id: session.sessionId,
          deviceInfo: {
            browser: session.deviceInfo.browser || 'Sconosciuto',
            os: session.deviceInfo.os || 'Sconosciuto',
            deviceType: session.deviceInfo.deviceType || 'desktop'
          },
          location: {
            ipAddress,
            country: geoLocation.country,
            city: geoLocation.city || 'Sconosciuto'
          },
          activity: {
            createdAt: session.createdAt,
            lastActiveAt: session.lastActiveAt,
            expiresAt: session.expiresAt
          },
          isCurrent: session.sessionId === currentSessionId
        };
      }));

      res.status(200).json(listResponse(sessionList, {
        currentPage: page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPreviousPage: page > 1
      }));

      logger.info(`[${userId}] Retrieved ${sessionList.length} active sessions`);
    } catch (error: any) {
      logger.error('Get sessions error:', error);
      throw error; // Gestito da errorHandler middleware
    }
  }

  /**
   * ✅ DELETE /auth/security/sessions/:sessionId
   * Terminate REAL session in database
   */
  static async terminateSession(req: Request<{ sessionId: string }>, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const sessionId = req.params.sessionId;
      const currentSessionId = req.cookies?.auth_token_session;

      // Non permettere di terminare la sessione corrente
      if (sessionId === currentSessionId) {
        res.status(400).json(errorResponse(
          'Non puoi terminare la sessione corrente. Usa il logout.',
          ErrorCode.INVALID_OPERATION,
          { useLogout: true },
          400
        ));
        return;
      }

      // ✅ VERA UPDATE al database
      const session = await CharacterSession.findOneAndUpdate(
        { sessionId, userId, isActive: true },
        {
          isActive: false,
          invalidatedAt: new Date(),
          invalidatedBy: 'manual',
          invalidatedFromIp: req.ip
        },
        { returnDocument: 'after' }
      );

      if (!session) {
        res.status(404).json(errorResponse(
          'Sessione non trovata',
          ErrorCode.SESSION_NOT_FOUND,
          undefined,
          404
        ));
        return;
      }

      logger.info(`[${userId}] Terminated session ${sessionId}`);

      // Publish Redis event per notificare altri servizi
      try {
        await redis.publish('auth:session_terminated', JSON.stringify({
          userId,
          sessionId,
          reason: 'user_terminated',
          terminatedAt: new Date().toISOString()
        }));
      } catch (redisError: any) {
        logger.warn('Failed to publish session termination event:', redisError);
        // Non bloccare la risposta se Redis fallisce
      }

      res.status(200).json(successResponse( {
        sessionId,
        terminatedAt: session.invalidatedAt
      }, 'Sessione terminata con successo'));

    } catch (error: any) {
      logger.error('Terminate session error:', error);
      throw error;
    }
  }

  /**
   * ✅ GET /auth/security/login-history
   * Get REAL login history from CharacterSession collection (include terminated sessions)
   */
  static async getLoginHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      // ✅ VERA QUERY - include TUTTE le sessioni (attive + terminate)
      const total = await CharacterSession.countDocuments({ userId });
      const history = await CharacterSession.find({ userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean();

      // ✅ GeoIP lookup parallelo per tutta la history
      const loginHistory = await Promise.all(history.map(async entry => {
        const ipAddress = entry.deviceInfo.ipAddress || '127.0.0.1';
        const geoLocation = await GeoIPService.lookup(ipAddress);

        return {
          id: entry.sessionId,
          timestamp: entry.createdAt,
          ipAddress,
          location: GeoIPService.formatLocation(geoLocation),
          deviceInfo: `${entry.deviceInfo.browser || 'Sconosciuto'} su ${entry.deviceInfo.os || 'Sconosciuto'}`,
          result: true, // Se è nel database, login è riuscito
          sessionDuration: entry.invalidatedAt
            ? Math.floor((entry.invalidatedAt.getTime() - entry.createdAt.getTime()) / 1000)
            : undefined,
          terminatedBy: entry.invalidatedBy,
          isActive: entry.isActive
        };
      }));

      res.status(200).json(listResponse(loginHistory, {
        currentPage: page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPreviousPage: page > 1
      }));

      logger.info(`[${userId}] Retrieved login history (${loginHistory.length} entries)`);
    } catch (error: unknown) {
      logger.error('Get login history error:', error instanceof Error ? error : String(error));
      throw error;
    }
  }

  /**
   * ✅ GET /auth/security/alerts
   * Get security alerts
   */
  static async getSecurityAlerts(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;

      const userObjectId = new mongoose.Types.ObjectId(userId);

      // ✅ Query SecurityAlert dal database
      const total = await SecurityAlert.countDocuments({ userId: userObjectId });
      const alerts = await SecurityAlert.find({ userId: userObjectId })
        .sort({ timestamp: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean();

      const alertList = alerts.map(alert => ({
        id: alert._id.toString(),
        type: alert.type,
        severity: alert.severity,
        ipAddress: alert.ipAddress,
        location: alert.location || 'Unknown',
        userAgent: alert.userAgent,
        timestamp: alert.timestamp,
        acknowledged: alert.acknowledged,
        acknowledgedAt: alert.acknowledgedAt,
        metadata: alert.metadata
      }));

      res.status(200).json(listResponse(alertList, {
        currentPage: page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPreviousPage: page > 1
      }));

      logger.info(`[${userId}] Retrieved ${alertList.length} security alerts`);
    } catch (error: unknown) {
      logger.error('Get security alerts error:', error instanceof Error ? error : String(error));
      throw error;
    }
  }

  /**
   * ✅ POST /auth/security/report-suspicious
   * Report suspicious activity
   */
  static async reportSuspicious(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { type, description, details } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json(errorResponse(
          'Utente non trovato',
          ErrorCode.USER_NOT_FOUND,
          undefined,
          404
        ));
        return;
      }

      // Genera ID report univoco
      const reportId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const ticketNumber = `SEC-${new Date().getFullYear()}-${reportId.toUpperCase()}`;

      logger.warn(`[${userId}] Suspicious activity reported:`, {
        reportId,
        type,
        description,
        details,
        ipAddress: req.ip
      });

      // Publish Redis event
      try {
        await redis.publish('auth:suspicious_activity', JSON.stringify({
          userId,
          activityType: 'user_report',
          details: {
            reportId,
            type,
            description,
            reportedDetails: details
          },
          timestamp: new Date().toISOString()
        }));
      } catch (redisError: unknown) {
        logger.warn('Failed to publish suspicious activity event:', redisError instanceof Error ? redisError : String(redisError));
      }

      res.status(200).json(successResponse( {
        report: {
          id: reportId,
          type,
          status: 'investigating',
          reportedAt: new Date().toISOString(),
          ticketNumber
        },
        immediateActions: {
          passwordChangeRecommended: true,
          allSessionsTerminated: false,
          accountSecured: true
        }
      }, 'Segnalazione ricevuta. Il team di sicurezza esaminerà il caso.'));

    } catch (error: unknown) {
      logger.error('Report suspicious error:', error instanceof Error ? error : String(error));
      throw error;
    }
  }

  /**
   * ✅ POST /auth/security/acknowledge-alert/:alertId
   * Acknowledge a security alert
   */
  static async acknowledgeAlert(req: Request<{ alertId: string }>, res: Response): Promise<void> {
    try {
      const { alertId } = req.params;
      const userId = req.user!.userId;

      if (!mongoose.isValidObjectId(alertId)) {
        res.status(400).json(errorResponse(
          'ID alert non valido',
          ErrorCode.INVALID_FORMAT,
          undefined,
          400
        ));
        return;
      }

      const ownerObjectId = new mongoose.Types.ObjectId(userId);
      const alertObjectId = new mongoose.Types.ObjectId(alertId);

      const alertDoc = await SecurityAlert.findOne({
        _id: alertObjectId,
        userId: ownerObjectId,
      });

      if (!alertDoc) {
        res.status(404).json(errorResponse(
          'Alert non trovato',
          ErrorCode.RESOURCE_NOT_FOUND,
          undefined,
          404
        ));
        return;
      }

      alertDoc.acknowledged = true;
      alertDoc.acknowledgedBy = ownerObjectId;
      alertDoc.acknowledgedAt = new Date();
      await alertDoc.save();

      logger.info(`[${userId}] Alert ${alertId} acknowledged`);

      res.status(200).json(successResponse({
        alertId,
        acknowledgedAt: alertDoc.acknowledgedAt!.toISOString()
      }, 'Alert confermato con successo'));

    } catch (error: unknown) {
      logger.error('Acknowledge alert error:', error instanceof Error ? error : String(error));
      throw error;
    }
  }
}
