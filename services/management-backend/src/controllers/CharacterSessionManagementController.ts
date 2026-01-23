import { Request, Response } from 'express';
import { CharacterSession } from '../../../database/models/CharacterSession';
import { Character } from '../../../database/models/Character';
import { User } from '../../../database/models/User';
import { logger } from '../utils/logger';
import { auditLogger } from '../utils/auditLogger';
import { listResponse, successResponse, errorResponse, updateResponse, deleteResponse, getRequestId } from '../utils/apiResponse';

export class CharacterSessionManagementController {

  static async getActiveSessions(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20, characterId, userId, deviceType } = req.query;

      // Build filter
      const filter: any = { isActive: true };
      
      if (characterId) filter.characterId = characterId;
      if (userId) filter.userId = userId;
      if (deviceType) filter['deviceInfo.deviceType'] = deviceType;

      const sessions = await CharacterSession.find(filter)
        .populate('characterId', 'name surname status gameplayRoles')
        .populate('userId', 'username email lastLoginAt')
        .sort({ lastActiveAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit));

      const total = await CharacterSession.countDocuments(filter);

      const formattedSessions = sessions.map(session => ({
        id: session._id,
        sessionId: session.sessionId,
        character: {
          id: session.characterId._id,
          name: session.characterId.name,
          surname: session.characterId.surname,
          status: session.characterId.status,
          gameplayRoles: session.characterId.gameplayRoles
        },
        user: {
          id: session.userId._id,
          username: session.userId.username,
          email: session.userId.email,
          lastLoginAt: session.userId.lastLoginAt
        },
        device: session.deviceInfo,
        isActive: session.isActive,
        createdAt: session.createdAt,
        lastActiveAt: session.lastActiveAt,
        expiresAt: session.expiresAt,
        durationMinutes: Math.floor((new Date().getTime() - session.createdAt.getTime()) / (1000 * 60)),
        timeUntilExpiry: Math.floor((session.expiresAt.getTime() - new Date().getTime()) / (1000 * 60))
      }));

      logger.info('Active character sessions retrieved', {
        total,
        page: Number(page),
        limit: Number(limit),
        filters: { characterId, userId, deviceType }
      });

      const pagination = {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
        limit: Number(limit),
        hasMore: Number(page) < Math.ceil(total / Number(limit))
      };

      res.json(listResponse(
        formattedSessions,
        pagination,
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving active sessions:', error);
      res.status(500).json(errorResponse(
        'Internal server error',
        'GET_ACTIVE_SESSIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async getSessionStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { timeRange = '24h' } = req.query;
      
      // Calculate time range
      const now = new Date();
      let startTime = new Date();
      
      switch (timeRange) {
        case '1h':
          startTime.setHours(now.getHours() - 1);
          break;
        case '24h':
          startTime.setHours(now.getHours() - 24);
          break;
        case '7d':
          startTime.setDate(now.getDate() - 7);
          break;
        case '30d':
          startTime.setDate(now.getDate() - 30);
          break;
        default:
          startTime.setHours(now.getHours() - 24);
      }

      // Current active sessions
      const currentActiveSessions = await CharacterSession.countDocuments({ 
        isActive: true 
      });

      // Sessions created in time range
      const sessionsInRange = await CharacterSession.countDocuments({
        createdAt: { $gte: startTime }
      });

      // Average session duration
      const avgDurationResult = await CharacterSession.aggregate([
        {
          $match: {
            isActive: false,
            invalidatedAt: { $exists: true, $gte: startTime }
          }
        },
        {
          $project: {
            duration: {
              $subtract: ['$invalidatedAt', '$createdAt']
            }
          }
        },
        {
          $group: {
            _id: null,
            avgDuration: { $avg: '$duration' }
          }
        }
      ]);

      // Device type breakdown
      const deviceBreakdown = await CharacterSession.aggregate([
        {
          $match: {
            createdAt: { $gte: startTime }
          }
        },
        {
          $group: {
            _id: '$deviceInfo.deviceType',
            count: { $sum: 1 }
          }
        }
      ]);

      // Peak concurrent sessions (approximate)
      const peakSessions = await CharacterSession.aggregate([
        {
          $match: {
            createdAt: { $gte: startTime }
          }
        },
        {
          $project: {
            hour: {
              $dateToString: {
                format: '%Y-%m-%d %H:00',
                date: '$createdAt'
              }
            }
          }
        },
        {
          $group: {
            _id: '$hour',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 1
        }
      ]);

      // Character with most sessions
      const mostActiveCharacters = await CharacterSession.aggregate([
        {
          $match: {
            createdAt: { $gte: startTime }
          }
        },
        {
          $group: {
            _id: '$characterId',
            sessionCount: { $sum: 1 }
          }
        },
        {
          $sort: { sessionCount: -1 }
        },
        {
          $limit: 5
        },
        {
          $lookup: {
            from: 'characters',
            localField: '_id',
            foreignField: '_id',
            as: 'character'
          }
        },
        {
          $unwind: '$character'
        },
        {
          $project: {
            characterId: '$_id',
            characterName: { $concat: ['$character.name', ' ', '$character.surname'] },
            sessionCount: 1
          }
        }
      ]);

      const avgDurationMinutes = avgDurationResult.length > 0 
        ? Math.floor(avgDurationResult[0].avgDuration / (1000 * 60))
        : 0;

      const statistics = {
        current: {
          activeSessions: currentActiveSessions,
          timeRange
        },
        period: {
          totalSessions: sessionsInRange,
          averageSessionDuration: `${avgDurationMinutes} minutes`,
          peakConcurrentSessions: peakSessions.length > 0 ? peakSessions[0].count : 0,
          peakTime: peakSessions.length > 0 ? peakSessions[0]._id : null
        },
        deviceBreakdown: deviceBreakdown.reduce((acc, device) => {
          acc[device._id] = device.count;
          return acc;
        }, {} as Record<string, number>),
        mostActiveCharacters,
        insights: {
          averageSessionsPerDay: Math.ceil(sessionsInRange / Math.max(1, 
            Math.ceil((now.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24)))),
          sessionTrend: sessionsInRange > 0 ? 'active' : 'inactive'
        }
      };

      logger.info('Session statistics retrieved', {
        timeRange,
        currentActive: currentActiveSessions,
        totalInRange: sessionsInRange
      });

      res.json(successResponse(
        { statistics },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving session statistics:', error);
      res.status(500).json(errorResponse(
        'Internal server error',
        'GET_SESSION_STATS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async getCharacterSessionHistory(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const { page = 1, limit = 20, includeActive = 'true' } = req.query;

      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse(
          'Character not found',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Build filter
      const filter: any = { characterId };
      if (includeActive !== 'true') {
        filter.isActive = false;
      }

      const sessions = await CharacterSession.find(filter)
        .populate('userId', 'username email')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit));

      const total = await CharacterSession.countDocuments(filter);

      const formattedSessions = sessions.map(session => {
        const duration = session.invalidatedAt 
          ? Math.floor((session.invalidatedAt.getTime() - session.createdAt.getTime()) / (1000 * 60))
          : session.isActive 
            ? Math.floor((new Date().getTime() - session.createdAt.getTime()) / (1000 * 60))
            : 0;

        return {
          id: session._id,
          sessionId: session.sessionId,
          user: {
            id: session.userId._id,
            username: session.userId.username,
            email: session.userId.email
          },
          device: session.deviceInfo,
          isActive: session.isActive,
          createdAt: session.createdAt,
          lastActiveAt: session.lastActiveAt,
          expiresAt: session.expiresAt,
          invalidatedAt: session.invalidatedAt,
          invalidatedBy: session.invalidatedBy,
          durationMinutes: duration,
          status: session.isActive ? 'active' : 
                  session.invalidatedBy === 'expired' ? 'expired' :
                  session.invalidatedBy === 'user_logout' ? 'logged out' : 'terminated'
        };
      });

      logger.info('Character session history retrieved', {
        characterId,
        total,
        page: Number(page)
      });

      res.json(successResponse(
        {
          character: {
            id: character._id,
            name: character.name,
            surname: character.surname,
            status: character.status
          },
          sessions: formattedSessions,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit))
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving character session history:', error);
      res.status(500).json(errorResponse(
        'Internal server error',
        'GET_CHARACTER_SESSION_HISTORY_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async invalidateSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { reason } = req.body;

      const session = await CharacterSession.findById(sessionId)
        .populate('characterId', 'name surname')
        .populate('userId', 'username');

      if (!session) {
        res.status(404).json(errorResponse(
          'Session not found',
          'SESSION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      if (!session.isActive) {
        res.status(400).json(errorResponse(
          'Session is already inactive',
          'SESSION_ALREADY_INACTIVE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Invalidate session
      session.isActive = false;
      session.invalidatedAt = new Date();
      session.invalidatedBy = 'manual';
      session.invalidatedFromIp = req.ip;
      await session.save();

      // Audit log
      auditLogger.logSuccess({
        userId: req.user?.userId || 'system',
        username: req.user?.username || 'System',
        action: 'CHARACTER_SESSION_INVALIDATED',
        resource: 'CHARACTER_SESSION',
        resourceId: session._id.toString(),
        details: {
          characterId: session.characterId._id.toString(),
          characterName: `${session.characterId.name} ${session.characterId.surname}`,
          userId: session.userId._id.toString(),
          username: session.userId.username,
          reason: reason || 'Manual invalidation by admin',
          deviceInfo: session.deviceInfo
        },
        request: req
      });

      logger.info('Character session invalidated', {
        sessionId: session._id,
        characterId: session.characterId._id,
        adminId: req.user?.userId,
        reason
      });

      res.json(updateResponse(
        {
          message: 'Session invalidated successfully',
          session: {
            id: session._id,
            characterName: `${session.characterId.name} ${session.characterId.surname}`,
            invalidatedAt: session.invalidatedAt
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error invalidating session:', error);
      res.status(500).json(errorResponse(
        'Internal server error',
        'INVALIDATE_SESSION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async invalidateAllCharacterSessions(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const { reason } = req.body;

      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse(
          'Character not found',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Find all active sessions for this character
      const activeSessions = await CharacterSession.find({
        characterId: characterId,
        isActive: true
      }).populate('userId', 'username');

      if (activeSessions.length === 0) {
        res.json(successResponse(
          {
            message: 'No active sessions found for this character',
            invalidatedCount: 0
          },
          undefined,
          getRequestId(req)
        ));
        return;
      }

      // Invalidate all sessions
      const updateResult = await CharacterSession.updateMany(
        {
          characterId: characterId,
          isActive: true
        },
        {
          $set: {
            isActive: false,
            invalidatedAt: new Date(),
            invalidatedBy: 'manual',
            invalidatedFromIp: req.ip
          }
        }
      );

      // Audit log
      auditLogger.logSuccess({
        userId: req.user?.userId || 'system',
        username: req.user?.username || 'System',
        action: 'CHARACTER_ALL_SESSIONS_INVALIDATED',
        resource: 'CHARACTER',
        resourceId: characterId,
        details: {
          characterName: `${character.name} ${character.surname}`,
          invalidatedSessionCount: updateResult.modifiedCount,
          reason: reason || 'All sessions manually invalidated by admin'
        },
        request: req
      });

      logger.info('All character sessions invalidated', {
        characterId,
        invalidatedCount: updateResult.modifiedCount,
        adminId: req.user?.userId,
        reason
      });

      res.json(updateResponse(
        {
          message: `Successfully invalidated ${updateResult.modifiedCount} sessions`,
          character: {
            id: character._id,
            name: character.name,
            surname: character.surname
          },
          invalidatedCount: updateResult.modifiedCount
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error invalidating all character sessions:', error);
      res.status(500).json(errorResponse(
        'Internal server error',
        'INVALIDATE_ALL_SESSIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async cleanExpiredSessions(req: Request, res: Response): Promise<void> {
    try {
      const now = new Date();

      // Find and update expired but still marked as active sessions
      const expiredSessionsUpdate = await CharacterSession.updateMany(
        {
          isActive: true,
          expiresAt: { $lt: now }
        },
        {
          $set: {
            isActive: false,
            invalidatedAt: now,
            invalidatedBy: 'expired'
          }
        }
      );

      // Optionally delete very old sessions (older than 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deleteResult = await CharacterSession.deleteMany({
        isActive: false,
        $or: [
          { invalidatedAt: { $lt: thirtyDaysAgo } },
          { createdAt: { $lt: thirtyDaysAgo }, invalidatedAt: { $exists: false } }
        ]
      });

      // Audit log
      auditLogger.logSuccess({
        userId: req.user?.userId || 'system',
        username: req.user?.username || 'System',
        action: 'SESSION_CLEANUP_PERFORMED',
        resource: 'CHARACTER_SESSION',
        resourceId: 'bulk',
        details: {
          expiredSessionsMarked: expiredSessionsUpdate.modifiedCount,
          oldSessionsDeleted: deleteResult.deletedCount
        },
        request: req
      });

      logger.info('Session cleanup completed', {
        expiredSessionsMarked: expiredSessionsUpdate.modifiedCount,
        oldSessionsDeleted: deleteResult.deletedCount,
        adminId: req.user?.userId
      });

      res.json(successResponse(
        {
          message: 'Session cleanup completed successfully',
          results: {
            expiredSessionsMarked: expiredSessionsUpdate.modifiedCount,
            oldSessionsDeleted: deleteResult.deletedCount
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error cleaning expired sessions:', error);
      res.status(500).json(errorResponse(
        'Internal server error',
        'CLEAN_EXPIRED_SESSIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}