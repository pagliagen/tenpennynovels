import { Request, Response } from 'express';
import { GamingSession } from '@database/models/GamingSession';
import { SessionManagement } from '@database/models/SessionManagement';
import { SessionTemplate } from '@database/models/SessionTemplate';
import { Character } from '@database/models/Character';
import { Location } from '@database/models/Location';
import { logger } from '../utils/logger';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '@shared/utils/apiResponse';


export class SessionManagementController {

  /**
   * Get session management overview with statistics
   * GET /admin/sessions/overview
   */
  static async getSessionOverview(req: Request, res: Response): Promise<void> {
    try {
      const { timeframe = '30d' } = req.query;
      
      // Calculate date range
      let startDate = new Date();
      switch (timeframe) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(startDate.getDate() - 30);
      }
      
      // Get session statistics
      const [totalSessions, activeSessions, completedSessions] = await Promise.all([
        GamingSession.countDocuments({ 
          createdAt: { $gte: startDate } 
        }),
        GamingSession.countDocuments({ 
          status: 'active' 
        }),
        GamingSession.countDocuments({ 
          status: 'completed',
          createdAt: { $gte: startDate }
        })
      ]);
      
      // Get session types breakdown
      const sessionTypeStats = await GamingSession.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$sessionType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      // Get master activity stats
      const masterStats = await GamingSession.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { 
          $group: { 
            _id: '$masterId', 
            masterName: { $first: '$masterName' },
            sessionCount: { $sum: 1 },
            completedSessions: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            totalPlaytime: { $sum: '$totalActiveTime' }
          } 
        },
        { $sort: { sessionCount: -1 } },
        { $limit: 10 }
      ]);
      
      // Get popular locations
      const locationStats = await GamingSession.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$primaryLocation', sessionCount: { $sum: 1 } } },
        { $sort: { sessionCount: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'locations',
            localField: '_id',
            foreignField: '_id',
            as: 'location'
          }
        },
        { $unwind: '$location' },
        {
          $project: {
            locationName: '$location.name',
            sessionCount: 1
          }
        }
      ]);
      
      // Get session templates usage
      const templateStats = await SessionTemplate.aggregate([
        { $sort: { timesUsed: -1 } },
        { $limit: 5 },
        {
          $project: {
            title: 1,
            category: 1,
            timesUsed: 1,
            averageRating: 1
          }
        }
      ]);
      
      const overview = {
        metrics: {
          totalSessions,
          activeSessions,
          completedSessions,
          completionRate: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0
        },
        sessionTypes: sessionTypeStats,
        topMasters: masterStats.map(master => ({
          ...master,
          averagePlaytime: master.completedSessions > 0 
            ? Math.round(master.totalPlaytime / master.completedSessions) 
            : 0
        })),
        popularLocations: locationStats,
        experienceStats: {
          totalExperienceGranted: 0,
          totalSkillPointsGranted: 0,
          totalGrants: 0,
          averageExperience: 0,
          averageSkillPoints: 0
        },
        popularTemplates: templateStats
      };
      
      res.json(successResponse(
        { overview },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: unknown) {
      logger.error('Failed to get session overview', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare la panoramica delle sessioni',
        'GET_SESSION_OVERVIEW_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get all sessions with filtering and pagination
   * GET /admin/sessions
   */
  static async getSessions(req: Request, res: Response): Promise<void> {
    try {
      const { 
        status, 
        masterId, 
        sessionType, 
        difficultyLevel,
        startDate,
        endDate,
        limit = 20, 
        skip = 0,
        sortBy = 'sessionDate',
        sortOrder = 'desc'
      } = req.query;
      
      let filter: any = {};
      
      if (status) {
        filter.status = status;
      }
      
      if (masterId) {
        filter.masterId = masterId;
      }
      
      if (sessionType) {
        filter.sessionType = sessionType;
      }
      
      if (difficultyLevel) {
        filter.difficultyLevel = difficultyLevel;
      }
      
      if (startDate || endDate) {
        filter.sessionDate = {};
        if (startDate) filter.sessionDate.$gte = new Date(startDate as string);
        if (endDate) filter.sessionDate.$lte = new Date(endDate as string);
      }
      
      const sortOption: any = {};
      sortOption[sortBy as string] = sortOrder === 'asc' ? 1 : -1;
      
      const sessions = await GamingSession.find(filter)
        .populate('masterId', 'name')
        .populate('primaryLocation', 'name description')
        .sort(sortOption)
        .limit(parseInt(limit as string))
        .skip(parseInt(skip as string));
      
      // Get session management data for each session
      const sessionIds = sessions.map(s => s._id);
      const sessionMgmts = await SessionManagement.find({ 
        sessionId: { $in: sessionIds } 
      });
      
      const sessionsWithMgmt = sessions.map(session => {
        const mgmt = sessionMgmts.find(sm => sm.sessionId.toString() === session._id?.toString());
        return {
          ...session.toJSON(),
          management: mgmt || null,
          participantCount: session.participants?.length || 0,
          isExperienceAssigned: session.experienceAssigned,
          hasActiveManagement: !!mgmt
        };
      });
      
      const totalCount = await GamingSession.countDocuments(filter);

      const page = Math.floor(parseInt(skip as string) / parseInt(limit as string)) + 1;
      const pagination = {
        currentPage: page,
        totalPages: Math.ceil(totalCount / parseInt(limit as string)),
        totalItems: totalCount,
        pageSize: parseInt(limit as string),
        hasNextPage: totalCount > parseInt(skip as string) + parseInt(limit as string),
        hasPreviousPage: page > 1
      };

      res.json(listResponse(
        sessionsWithMgmt,
        pagination,
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: unknown) {
      logger.error('Failed to get sessions', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare le sessioni',
        'GET_SESSIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get detailed session information
   * GET /admin/sessions/:sessionId
   */
  static async getSessionDetail(req: Request<{ sessionId: string }>, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      
      const session = await GamingSession.findById(sessionId)
        .populate('masterId', 'name email gameplayRoles')
        .populate('primaryLocation', 'name description parentLocation')
        .populate({
          path: 'participants.characterId',
          select: 'name occupation gameplayRoles'
        });
      
      if (!session) {
        res.status(404).json(errorResponse(
          'Sessione non trovata',
          'SESSION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }
      
      // Get session management data
      const sessionMgmt = await SessionManagement.findOne({ sessionId })
        .populate('participantManagement.registrations.characterId', 'name')
        .populate('participantManagement.waitlist.characterId', 'name')
        .populate('liveSession.participantStatus.characterId', 'name');
      
      const sessionDetail = {
        ...session!.toJSON(),
        management: sessionMgmt,
        experienceDetails: [],
        analytics: {
          participantCount: session!.participants?.length || 0,
          completionRate: session!.status === 'completed' ? 100 : 0,
          experienceGranted: 0,
          skillPointsGranted: 0
        }
      };
      
      res.json(successResponse(
        { session: sessionDetail },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: unknown) {
      logger.error('Failed to get session detail', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare i dettagli della sessione',
        'GET_SESSION_DETAIL_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get session templates with management capabilities
   * GET /admin/session-templates
   */
  static async getSessionTemplates(req: Request, res: Response): Promise<void> {
    try {
      const { 
        category, 
        difficulty, 
        isPublic, 
        createdBy,
        limit = 50,
        skip = 0 
      } = req.query;
      
      let filter: any = {};
      
      if (category) {
        filter.category = category;
      }
      
      if (difficulty) {
        filter.difficulty = difficulty;
      }
      
      if (isPublic !== undefined) {
        filter.isPublic = isPublic === 'true';
      }
      
      if (createdBy) {
        filter.createdBy = createdBy;
      }
      
      const templates = await SessionTemplate.find(filter)
        .populate('createdBy', 'name gameplayRoles')
        .sort({ timesUsed: -1, averageRating: -1 })
        .limit(parseInt(limit as string))
        .skip(parseInt(skip as string));
      
      const totalCount = await SessionTemplate.countDocuments(filter);
      
      // Get usage statistics for each template
      const templatesWithStats = await Promise.all(
        templates.map(async (template) => {
          const recentUsage = await GamingSession.countDocuments({
            // Note: would need to add templateId field to GamingSession model
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          });
          
          return {
            ...template.toJSON(),
            stats: {
              recentUsage,
              sceneCount: template.scenes?.length || 0,
              avgSceneDuration: template.scenes?.reduce((sum: any, scene: any) => sum + scene.estimatedTime, 0) / (template.scenes?.length || 1)
            }
          };
        })
      );

      const page = Math.floor(parseInt(skip as string) / parseInt(limit as string)) + 1;
      const pagination = {
        currentPage: page,
        totalPages: Math.ceil(totalCount / parseInt(limit as string)),
        totalItems: totalCount,
        pageSize: parseInt(limit as string),
        hasNextPage: totalCount > parseInt(skip as string) + parseInt(limit as string),
        hasPreviousPage: page > 1
      };

      res.json(listResponse(
        templatesWithStats,
        pagination,
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: unknown) {
      logger.error('Failed to get session templates', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare i template delle sessioni',
        'GET_TEMPLATES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get session analytics and trends
   * GET /admin/sessions/analytics
   */
  static async getSessionAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { timeframe = '30d' } = req.query;
      
      // Calculate date range
      let startDate = new Date();
      switch (timeframe) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(startDate.getDate() - 30);
      }
      
      // Session trends over time
      const sessionTrends = await GamingSession.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            sessionsCreated: { $sum: 1 },
            sessionsCompleted: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            totalPlaytime: { $sum: '$totalActiveTime' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);
      
      // Master performance metrics
      const masterPerformance = await GamingSession.aggregate([
        { $match: { createdAt: { $gte: startDate }, status: 'completed' } },
        {
          $group: {
            _id: '$masterId',
            masterName: { $first: '$masterName' },
            sessionCount: { $sum: 1 },
            totalPlaytime: { $sum: '$totalActiveTime' },
            totalParticipants: { $sum: { $size: '$participants' } },
            avgDifficulty: {
              $avg: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$difficultyLevel', 'easy'] }, then: 1 },
                    { case: { $eq: ['$difficultyLevel', 'medium'] }, then: 2 },
                    { case: { $eq: ['$difficultyLevel', 'hard'] }, then: 3 },
                    { case: { $eq: ['$difficultyLevel', 'extreme'] }, then: 4 }
                  ],
                  default: 2
                }
              }
            }
          }
        },
        {
          $addFields: {
            avgPlaytime: { $divide: ['$totalPlaytime', '$sessionCount'] },
            avgParticipants: { $divide: ['$totalParticipants', '$sessionCount'] }
          }
        },
        { $sort: { sessionCount: -1 } },
        { $limit: 20 }
      ]);
      
      // Participation patterns
      const participationMetrics = await GamingSession.aggregate([
        { $match: { createdAt: { $gte: startDate }, status: 'completed' } },
        { $unwind: '$participants' },
        {
          $group: {
            _id: '$participants.characterId',
            sessionsParticipated: { $sum: 1 },
            totalPlaytime: { $sum: '$totalActiveTime' },
            avgParticipationScore: { $avg: '$participants.participationScore' }
          }
        },
        {
          $lookup: {
            from: 'characters',
            localField: '_id',
            foreignField: '_id',
            as: 'character'
          }
        },
        { $unwind: '$character' },
        {
          $project: {
            characterName: '$character.name',
            sessionsParticipated: 1,
            totalPlaytime: 1,
            avgParticipationScore: 1,
            avgPlaytimePerSession: { 
              $divide: ['$totalPlaytime', '$sessionsParticipated'] 
            }
          }
        },
        { $sort: { sessionsParticipated: -1 } },
        { $limit: 20 }
      ]);
      
      const analytics = {
        trends: sessionTrends,
        masterPerformance,
        participationMetrics,
        summary: {
          timeframe,
          startDate,
          endDate: new Date()
        }
      };
      
      res.json(successResponse(
        { analytics },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: unknown) {
      logger.error('Failed to get session analytics', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare le analitiche delle sessioni',
        'GET_SESSION_ANALYTICS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update session status (Admin action)
   * PUT /admin/sessions/:sessionId/status
   */
  static async updateSessionStatus(req: Request<{ sessionId: string }>, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { status, reason } = req.body;
      const adminId = req.user!.userId;
      
      if (!['planned', 'active', 'completed', 'cancelled', 'postponed'].includes(status)) {
        res.status(400).json(errorResponse(
          'Valore di stato non valido',
          'INVALID_STATUS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }
      
      const session = await GamingSession.findById(sessionId);
      if (!session) {
        res.status(404).json(errorResponse(
          'Sessione non trovata',
          'SESSION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }
      
      const oldStatus = session.status;
      session.status = status;
      
      if (status === 'cancelled' || status === 'postponed') {
        session.requiresReview = true;
        session.reviewNotes = reason || `Session ${status} by admin`;
      }
      
      await session.save();
      
      logger.info('Session status updated by admin', {
        sessionId,
        oldStatus,
        newStatus: status,
        adminId,
        reason
      });
      
      res.json(updateResponse(
        {
          sessionId,
          oldStatus,
          newStatus: status
        },
        'Session status updated successfully',
        getRequestId(req)
      ));
      
    } catch (error: unknown) {
      logger.error('Failed to update session status', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile aggiornare lo stato della sessione',
        'UPDATE_SESSION_STATUS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get sessions pending XP assignment for current master
   * GET /admin/sessions/pending-xp-assignment
   */
  static async getPendingXPAssignment(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      // Get masterId from authenticated user
      const masterId = req.character?.characterId;

      if (!masterId) {
        res.status(400).json(errorResponse(
          'Master ID not found in request',
          'MASTER_ID_MISSING',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Find completed sessions without XP assigned
      const sessions = await GamingSession.find({
        status: 'completed',
        experienceAssigned: false,
        masterId: masterId
      })
      .sort({ sessionDate: 1 }) // Oldest first
      .limit(limit)
      .select('title sessionDate completedAt participants')
      .lean();

      // Transform data
      const transformedSessions = sessions.map((s: any) => ({
        id: s._id.toString(),
        title: s.title,
        sessionDate: s.sessionDate,
        completedAt: s.completedAt,
        participantCount: s.participants?.length || 0,
        daysOverdue: s.completedAt
          ? Math.floor((Date.now() - new Date(s.completedAt).getTime()) / (1000 * 60 * 60 * 24))
          : 0
      }));

      res.json(successResponse(
        {
          sessions: transformedSessions,
          count: transformedSessions.length
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error getting pending XP assignment sessions:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare le sessioni in attesa di assegnazione XP',
        'GET_PENDING_XP_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}
