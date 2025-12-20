import { Request, Response } from 'express';
import { CharacterSession } from '../../../../packages/database/models/CharacterSession';
import { logger } from '../utils/logger';
import { AuthUtils } from '../utils/auth';
import { auditLogger } from '../utils/auditLogger';

export class CharacterSessionController {

  static async getMyActiveSessions(req: Request, res: Response): Promise<void> {
    try {
      const authResult = AuthUtils.authenticate(req);
      if (!authResult.success) {
        res.status(401).json({
          success: false,
          error: authResult.error
        });
        return;
      }

      const character = authResult.character;

      // Get active sessions for this character
      const activeSessions = await CharacterSession.find({
        characterId: character._id,
        isActive: true
      }).sort({ lastActiveAt: -1 });

      const currentSessionToken = req.cookies?.character_context;
      
      const formattedSessions = activeSessions.map(session => {
        const isCurrent = currentSessionToken && 
          AuthUtils.decodeCharacterContext(currentSessionToken)?.sessionId === session.sessionId;

        return {
          id: session._id,
          sessionId: session.sessionId,
          device: {
            type: session.deviceInfo.deviceType,
            browser: session.deviceInfo.browser,
            os: session.deviceInfo.os,
            deviceName: session.deviceInfo.deviceName || `${session.deviceInfo.browser} on ${session.deviceInfo.os}`
          },
          createdAt: session.createdAt,
          lastActiveAt: session.lastActiveAt,
          expiresAt: session.expiresAt,
          isCurrent,
          durationMinutes: Math.floor((new Date().getTime() - session.createdAt.getTime()) / (1000 * 60)),
          timeUntilExpiry: Math.floor((session.expiresAt.getTime() - new Date().getTime()) / (1000 * 60))
        };
      });

      logger.info('Character active sessions retrieved', {
        characterId: character._id,
        activeSessionCount: formattedSessions.length
      });

      res.json({
        success: true,
        data: {
          character: {
            id: character._id,
            name: character.name,
            surname: character.surname
          },
          sessions: formattedSessions,
          totalActiveSessions: formattedSessions.length
        }
      });

    } catch (error: any) {
      logger.error('Error retrieving character active sessions:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  static async getMySessionHistory(req: Request, res: Response): Promise<void> {
    try {
      const authResult = AuthUtils.authenticate(req);
      if (!authResult.success) {
        res.status(401).json({
          success: false,
          error: authResult.error
        });
        return;
      }

      const character = authResult.character;
      const { page = 1, limit = 20, includeActive = 'true' } = req.query;

      // Build filter
      const filter: any = { characterId: character._id };
      if (includeActive !== 'true') {
        filter.isActive = false;
      }

      const sessions = await CharacterSession.find(filter)
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
          device: {
            type: session.deviceInfo.deviceType,
            browser: session.deviceInfo.browser,
            os: session.deviceInfo.os,
            deviceName: session.deviceInfo.deviceName || `${session.deviceInfo.browser} on ${session.deviceInfo.os}`
          },
          isActive: session.isActive,
          createdAt: session.createdAt,
          lastActiveAt: session.lastActiveAt,
          expiresAt: session.expiresAt,
          invalidatedAt: session.invalidatedAt,
          endReason: session.invalidatedBy,
          durationMinutes: duration,
          status: session.isActive ? 'active' : 
                  session.invalidatedBy === 'expired' ? 'expired' :
                  session.invalidatedBy === 'user_logout' ? 'logged out' : 
                  session.invalidatedBy === 'new_device_login' ? 'replaced by new login' : 'ended'
        };
      });

      // Calculate session statistics
      const sessionStats = {
        totalSessions: await CharacterSession.countDocuments({ characterId: character._id }),
        activeSessions: await CharacterSession.countDocuments({ characterId: character._id, isActive: true }),
        averageSessionDuration: 0,
        longestSession: 0,
        mostUsedDevice: 'unknown'
      };

      // Calculate average session duration from completed sessions
      const completedSessions = await CharacterSession.find({
        characterId: character._id,
        isActive: false,
        invalidatedAt: { $exists: true }
      });

      if (completedSessions.length > 0) {
        const totalDuration = completedSessions.reduce((sum, session) => {
          return sum + (session.invalidatedAt!.getTime() - session.createdAt.getTime());
        }, 0);
        sessionStats.averageSessionDuration = Math.floor(totalDuration / (completedSessions.length * 1000 * 60));

        const longestSessionDuration = Math.max(...completedSessions.map(session => 
          session.invalidatedAt!.getTime() - session.createdAt.getTime()
        ));
        sessionStats.longestSession = Math.floor(longestSessionDuration / (1000 * 60));
      }

      // Find most used device type
      const deviceStats = await CharacterSession.aggregate([
        { $match: { characterId: character._id } },
        {
          $group: {
            _id: '$deviceInfo.deviceType',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ]);

      if (deviceStats.length > 0) {
        sessionStats.mostUsedDevice = deviceStats[0]._id;
      }

      logger.info('Character session history retrieved', {
        characterId: character._id,
        totalSessions: total,
        page: Number(page)
      });

      res.json({
        success: true,
        data: {
          character: {
            id: character._id,
            name: character.name,
            surname: character.surname
          },
          sessions: formattedSessions,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit))
          },
          statistics: sessionStats
        }
      });

    } catch (error: any) {
      logger.error('Error retrieving character session history:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  static async invalidateSession(req: Request, res: Response): Promise<void> {
    try {
      const authResult = AuthUtils.authenticate(req);
      if (!authResult.success) {
        res.status(401).json({
          success: false,
          error: authResult.error
        });
        return;
      }

      const character = authResult.character;
      const { sessionId } = req.params;

      // Find the session and verify it belongs to this character
      const session = await CharacterSession.findOne({
        _id: sessionId,
        characterId: character._id
      });

      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Session not found or does not belong to you'
        });
        return;
      }

      if (!session.isActive) {
        res.status(400).json({
          success: false,
          error: 'Session is already inactive'
        });
        return;
      }

      // Don't allow invalidating the current session (would be confusing)
      const currentSessionToken = req.cookies?.character_context;
      const currentSession = currentSessionToken ? AuthUtils.decodeCharacterContext(currentSessionToken) : null;
      
      if (currentSession?.sessionId === session.sessionId) {
        res.status(400).json({
          success: false,
          error: 'Cannot invalidate your current session. Please use logout instead.'
        });
        return;
      }

      // Invalidate the session
      session.isActive = false;
      session.invalidatedAt = new Date();
      session.invalidatedBy = 'user_logout';
      session.invalidatedFromIp = req.ip;
      await session.save();

      // Audit log
      await auditLogger.log({
        action: 'CHARACTER_SESSION_SELF_INVALIDATED',
        actorType: 'CHARACTER',
        actorId: character._id.toString(),
        actorName: `${character.name} ${character.surname}`,
        resourceType: 'CHARACTER_SESSION',
        resourceId: session._id.toString(),
        details: {
          sessionId: session.sessionId,
          deviceType: session.deviceInfo.deviceType,
          deviceName: session.deviceInfo.deviceName || 'Unknown device'
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      logger.info('Character session self-invalidated', {
        sessionId: session._id,
        characterId: character._id,
        deviceType: session.deviceInfo.deviceType
      });

      res.json({
        success: true,
        data: {
          message: 'Session invalidated successfully',
          invalidatedSession: {
            id: session._id,
            deviceName: session.deviceInfo.deviceName || `${session.deviceInfo.browser} on ${session.deviceInfo.os}`,
            invalidatedAt: session.invalidatedAt
          }
        }
      });

    } catch (error: any) {
      logger.error('Error invalidating character session:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  static async invalidateAllOtherSessions(req: Request, res: Response): Promise<void> {
    try {
      const authResult = AuthUtils.authenticate(req);
      if (!authResult.success) {
        res.status(401).json({
          success: false,
          error: authResult.error
        });
        return;
      }

      const character = authResult.character;
      
      // Get current session to avoid invalidating it
      const currentSessionToken = req.cookies?.character_context;
      const currentSession = currentSessionToken ? AuthUtils.decodeCharacterContext(currentSessionToken) : null;
      
      const filter: any = {
        characterId: character._id,
        isActive: true
      };

      // Don't invalidate current session
      if (currentSession?.sessionId) {
        filter.sessionId = { $ne: currentSession.sessionId };
      }

      // Find other active sessions
      const otherSessions = await CharacterSession.find(filter);

      if (otherSessions.length === 0) {
        res.status(200).json({
          success: true,
          data: {
            message: 'No other active sessions found',
            invalidatedCount: 0
          }
        });
        return;
      }

      // Invalidate all other sessions
      const updateResult = await CharacterSession.updateMany(
        filter,
        {
          $set: {
            isActive: false,
            invalidatedAt: new Date(),
            invalidatedBy: 'user_logout',
            invalidatedFromIp: req.ip
          }
        }
      );

      // Audit log
      await auditLogger.log({
        action: 'CHARACTER_ALL_OTHER_SESSIONS_INVALIDATED',
        actorType: 'CHARACTER',
        actorId: character._id.toString(),
        actorName: `${character.name} ${character.surname}`,
        resourceType: 'CHARACTER_SESSION',
        resourceId: 'multiple',
        details: {
          invalidatedSessionCount: updateResult.modifiedCount,
          keptCurrentSession: !!currentSession?.sessionId
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      logger.info('All other character sessions invalidated', {
        characterId: character._id,
        invalidatedCount: updateResult.modifiedCount,
        keptCurrentSession: !!currentSession?.sessionId
      });

      res.json({
        success: true,
        data: {
          message: `Successfully signed out from ${updateResult.modifiedCount} other devices`,
          invalidatedCount: updateResult.modifiedCount
        }
      });

    } catch (error: any) {
      logger.error('Error invalidating all other character sessions:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  static async getCurrentSession(req: Request, res: Response): Promise<void> {
    try {
      const authResult = AuthUtils.authenticate(req);
      if (!authResult.success) {
        res.status(401).json({
          success: false,
          error: authResult.error
        });
        return;
      }

      const character = authResult.character;
      const currentSessionToken = req.cookies?.character_context;
      
      if (!currentSessionToken) {
        res.status(400).json({
          success: false,
          error: 'No active character session found'
        });
        return;
      }

      const currentSessionData = AuthUtils.decodeCharacterContext(currentSessionToken);
      if (!currentSessionData) {
        res.status(400).json({
          success: false,
          error: 'Invalid session token'
        });
        return;
      }

      // Find the session in database
      const session = await CharacterSession.findOne({
        sessionId: currentSessionData.sessionId,
        characterId: character._id,
        isActive: true
      });

      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Session not found in database'
        });
        return;
      }

      const currentSession = {
        id: session._id,
        sessionId: session.sessionId,
        character: {
          id: character._id,
          name: character.name,
          surname: character.surname,
          gameplayRoles: character.gameplayRoles
        },
        device: {
          type: session.deviceInfo.deviceType,
          browser: session.deviceInfo.browser,
          os: session.deviceInfo.os,
          deviceName: session.deviceInfo.deviceName || `${session.deviceInfo.browser} on ${session.deviceInfo.os}`,
          ipAddress: session.deviceInfo.ipAddress
        },
        createdAt: session.createdAt,
        lastActiveAt: session.lastActiveAt,
        expiresAt: session.expiresAt,
        durationMinutes: Math.floor((new Date().getTime() - session.createdAt.getTime()) / (1000 * 60)),
        timeUntilExpiry: Math.floor((session.expiresAt.getTime() - new Date().getTime()) / (1000 * 60)),
        isExpiringSoon: (session.expiresAt.getTime() - new Date().getTime()) < (30 * 60 * 1000) // Less than 30 minutes
      };

      logger.info('Current character session retrieved', {
        sessionId: session._id,
        characterId: character._id
      });

      res.json({
        success: true,
        data: {
          currentSession
        }
      });

    } catch (error: any) {
      logger.error('Error retrieving current character session:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}