import { Request, Response } from 'express';
import {
  ExperienceGrant,
  CharacterProgression,
  GamingSession,
  Character,
  db
} from '@database/models';
import { logger } from '../utils/logger';
import { redis } from '@config/runtime/redis';
import { listResponse, successResponse, errorResponse, createResponse, updateResponse, deleteResponse, getRequestId } from '../utils/apiResponse';

// Access mongoose from the centralized connection
const mongoose = db.getMongoose();

export class ExperienceManagementController {

  /**
   * Get experience overview and statistics
   * GET /admin/experience/overview
   */
  static async getExperienceOverview(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20, timeRange = '30d' } = req.query;
      
      // Calculate date range
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      // Get aggregate statistics
      const [grantsCount, totalXPGranted, totalSkillsGranted, activeCharacters, recentGrants] = await Promise.all([
        ExperienceGrant.countDocuments({ createdAt: { $gte: dateFrom } }),
        
        ExperienceGrant.aggregate([
          { $match: { createdAt: { $gte: dateFrom } } },
          { $group: { _id: null, total: { $sum: '$experiencePoints' } } }
        ]),
        
        ExperienceGrant.aggregate([
          { $match: { createdAt: { $gte: dateFrom } } },
          { $group: { _id: null, total: { $sum: '$skillPoints' } } }
        ]),
        
        CharacterProgression.countDocuments({
          'activityMetrics.lastActivityCheck': { $gte: dateFrom }
        }),
        
        ExperienceGrant.find({ createdAt: { $gte: dateFrom } })
          .populate('characterId', 'name')
          .populate('grantedBy', 'name')
          .sort({ createdAt: -1 })
          .limit(parseInt(limit as string))
          .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      ]);
      
      // Get grant type breakdown
      const grantTypeStats = await ExperienceGrant.aggregate([
        { $match: { createdAt: { $gte: dateFrom } } },
        { $group: { 
          _id: '$grantType', 
          count: { $sum: 1 },
          totalXP: { $sum: '$experiencePoints' },
          totalSkills: { $sum: '$skillPoints' }
        }},
        { $sort: { count: -1 } }
      ]);
      
      // Get top masters by grants given
      const topMasters = await ExperienceGrant.aggregate([
        { 
          $match: { 
            createdAt: { $gte: dateFrom },
            grantedByType: 'master'
          }
        },
        { $group: { 
          _id: '$grantedBy',
          name: { $first: '$grantedByName' },
          grantsGiven: { $sum: 1 },
          totalXP: { $sum: '$experiencePoints' },
          totalSkills: { $sum: '$skillPoints' }
        }},
        { $sort: { grantsGiven: -1 } },
        { $limit: 10 }
      ]);
      
      res.json(successResponse(
        {
          overview: {
            grantsInPeriod: grantsCount,
            totalXPGranted: totalXPGranted[0]?.total || 0,
            totalSkillsGranted: totalSkillsGranted[0]?.total || 0,
            activeCharacters,
            averageXPPerCharacter: activeCharacters > 0 ? Math.round((totalXPGranted[0]?.total || 0) / activeCharacters) : 0
          },
          grantTypeBreakdown: grantTypeStats,
          topMasters,
          recentGrants: recentGrants,
          pagination: {
            page: parseInt(page as string),
            pageSize: parseInt(limit as string),
            totalGrants: grantsCount
          }
        },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Failed to get experience overview', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare la panoramica esperienza',
        'EXPERIENCE_OVERVIEW_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get gaming sessions overview
   * GET /admin/experience/sessions
   */
  static async getSessionsOverview(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20, status, masterId } = req.query;
      
      // Build query filter
      const filter: any = {};
      if (status) filter.status = status;
      if (masterId) filter.masterId = masterId;
      
      const [sessions, totalCount] = await Promise.all([
        GamingSession.find(filter)
          .populate('masterId', 'name')
          .populate('primaryLocation', 'name')
          .populate('participants.characterId', 'name')
          .sort({ sessionDate: -1 })
          .limit(parseInt(limit as string))
          .skip((parseInt(page as string) - 1) * parseInt(limit as string)),
          
        GamingSession.countDocuments(filter)
      ]);
      
      // Get session statistics
      const sessionStats = await GamingSession.aggregate([
        { $match: filter },
        { $group: {
          _id: '$status',
          count: { $sum: 1 },
          averageDuration: { $avg: '$totalActiveTime' },
          averageXP: { $avg: '$baseExperienceReward' },
          averageSkills: { $avg: '$baseSkillPointReward' }
        }}
      ]);
      
      const pagination = {
        page: parseInt(page as string),
        totalPages: Math.ceil(totalCount / parseInt(limit as string)),
        totalItems: totalCount,
        pageSize: parseInt(limit as string),
        hasNextPage: parseInt(page as string) < Math.ceil(totalCount / parseInt(limit as string)),
        hasPrevPage: page > 1
      };

      res.json(successResponse(
        {
          sessions,
          statistics: sessionStats,
          pagination
        },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Failed to get sessions overview', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare la panoramica sessioni',
        'SESSIONS_OVERVIEW_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Create a new gaming session
   * POST /admin/experience/sessions
   */
  static async createGamingSession(req: Request, res: Response): Promise<void> {
    try {
      const {
        title,
        description,
        masterId,
        sessionDate,
        startTime,
        estimatedDuration,
        primaryLocation,
        sessionType,
        difficultyLevel,
        participantIds,
        baseExperienceReward,
        baseSkillPointReward
      } = req.body;
      
      // Verify master exists and has master role
      const master = await Character.findById(masterId);
      if (!master || !master.gameplayRoles.includes('master')) {
        res.status(400).json(errorResponse(
          'Master specificato non valido',
          'INVALID_MASTER',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }
      
      // Verify participants exist
      const participants = await Character.find({
        _id: { $in: participantIds },
        status: 'APPROVED'
      });
      
      if (participants.length !== participantIds.length) {
        res.status(400).json(errorResponse(
          'Alcuni partecipanti non sono validi o non approvati',
          'INVALID_PARTICIPANTS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }
      
      // Create session
      const session = new GamingSession({
        title,
        description,
        masterId,
        masterName: master.name,
        sessionDate: new Date(sessionDate),
        startTime: new Date(startTime),
        estimatedDuration,
        primaryLocation,
        sessionType,
        difficultyLevel,
        baseExperienceReward: baseExperienceReward || 5,
        baseSkillPointReward: baseSkillPointReward || 3,
        participants: participants.map(participant => ({
          characterId: participant._id,
          characterName: participant.name,
          joinedAt: new Date(),
          wasActive: true,
          participationScore: 5
        })),
        status: 'planned'
      });
      
      await session.save();
      
      logger.info('Gaming session created', {
        sessionId: session._id,
        title,
        masterId,
        participantCount: participants.length
      });
      
      res.json(createResponse(
        { sessionId: session._id, session },
        'Gaming session created successfully',
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Failed to create gaming session', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile creare la sessione di gioco',
        'CREATE_SESSION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update gaming session
   * PUT /admin/experience/sessions/:sessionId
   */
  static async updateGamingSession(req: Request<{ sessionId: string }>, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const updates = req.body;
      
      const session = await GamingSession.findByIdAndUpdate(
        sessionId,
        { ...updates, updatedAt: new Date() },
        { new: true, runValidators: true }
      );
      
      if (!session) {
        res.status(404).json(errorResponse(
          'Sessione di gioco non trovata',
          'SESSION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }
      
      logger.info('Gaming session updated', {
        sessionId,
        updates: Object.keys(updates)
      });
      
      res.json(updateResponse(
        { session },
        'Gaming session updated successfully',
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Failed to update gaming session', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile aggiornare la sessione di gioco',
        'UPDATE_SESSION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Assign experience from completed session
   * POST /admin/experience/sessions/:sessionId/assign-experience
   */
  static async assignSessionExperience(req: Request<{ sessionId: string }>, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { participantScores, masterComment, skipNotifications } = req.body;
      
      const session = await GamingSession.findById(sessionId)
        .populate('participants.characterId')
        .populate('masterId');
        
      if (!session) {
        res.status(404).json(errorResponse(
          'Sessione di gioco non trovata',
          'SESSION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }
      
      if (session.experienceAssigned) {
        res.status(400).json(errorResponse(
          'Esperienza già assegnata a questa sessione',
          'EXPERIENCE_ALREADY_ASSIGNED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }
      
      if (session.status !== 'completed') {
        res.status(400).json(errorResponse(
          'La sessione deve essere completata prima di assegnare esperienza',
          'SESSION_NOT_COMPLETED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }
      
      const grants: any[] = [];
      const session_mongoose = await mongoose.startSession();
      
      await session_mongoose.withTransaction(async () => {
        // Create experience grants for each participant
        for (const participant of session.participants) {
          const participationScore = participantScores?.[participant.characterId.toString()] || participant.participationScore;
          const multiplier = (participationScore / 5) * (session.experienceMultiplier || 1); // Base is 5, so this creates 0.2-2.0 multiplier

          const finalXP = Math.round((session.baseExperienceReward || 0) * multiplier);
          const finalSkills = Math.round((session.baseSkillPointReward || 0) * multiplier);
          
          const grant = new ExperienceGrant({
            characterId: participant.characterId,
            grantedBy: session.masterId,
            grantedByType: 'master',
            grantedByName: session.masterName,
            grantType: 'session_participation',
            category: session.sessionType,
            experiencePoints: finalXP,
            skillPoints: finalSkills,
            reason: `Session participation: ${session.title}`,
            masterComment,
            sessionId: session._id,
            sessionDetails: {
              sessionDate: session.sessionDate,
              sessionTitle: session.title,
              primaryLocation: session.primaryLocation,
              sessionType: session.sessionType,
              participants: session.participants.map((p: any) => p.characterId),
              difficultyRating: session.difficultyLevel,
              masterNotes: session.masterNotes
            }
          });
          
          await grant.save({ session: session_mongoose });
          grants.push(grant);
          
          // Update character progression
          await this.updateCharacterProgression(participant.characterId, finalXP, finalSkills, session_mongoose);
        }
        
        // Mark session as experience assigned
        session.experienceAssigned = true;
        session.experienceGrants = grants.map(g => g._id);
        await session.save({ session: session_mongoose });
      });
      
      session_mongoose.endSession();
      
      // Send notifications if not skipped
      if (!skipNotifications) {
        await this.sendSessionNotifications(sessionId, grants);
      }
      
      logger.info('Session experience assigned', {
        sessionId,
        grantsCreated: grants.length,
        totalXP: grants.reduce((sum, g) => sum + g.experiencePoints, 0),
        totalSkills: grants.reduce((sum, g) => sum + g.skillPoints, 0)
      });
      
      res.json(createResponse(
        {
          grantsCreated: grants.length,
          grants: grants.map(g => ({
            characterId: g.characterId,
            experiencePoints: g.experiencePoints,
            skillPoints: g.skillPoints
          }))
        },
        'Experience assigned successfully',
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Failed to assign session experience', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile assegnare esperienza di sessione',
        'ASSIGN_EXPERIENCE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get character progression details (admin view)
   * GET /admin/experience/characters/:characterId/progression
   */
  static async getCharacterProgressionDetails(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      
      const [character, progression, grants, sessions] = await Promise.all([
        Character.findById(characterId),
        CharacterProgression.findOne({ characterId }),
        ExperienceGrant.find({ characterId })
          .populate('grantedBy', 'name')
          .sort({ createdAt: -1 })
          .limit(50),
        GamingSession.find({ 'participants.characterId': characterId })
          .populate('masterId', 'name')
          .sort({ sessionDate: -1 })
          .limit(20)
      ]);
      
      if (!character) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }
      
      res.json(successResponse(
        {
          character: {
            id: character._id,
            name: character.name,
            status: character.status,
            stats: character.stats,
            skills: character.skills,
            gameplayRoles: character.gameplayRoles
          },
          progression,
          grants,
          sessions
        },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Failed to get character progression details', {
        characterId: req.params.characterId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare i dettagli di progressione del personaggio',
        'PROGRESSION_DETAILS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Manual experience grant (admin override)
   * POST /admin/experience/manual-grant
   */
  static async manualExperienceGrant(req: Request, res: Response): Promise<void> {
    try {
      const {
        characterIds,
        experiencePoints,
        skillPoints,
        reason,
        comment,
        category,
        grantedBy
      } = req.body;
      
      // Verify admin has permission
      // grantedBy should be the Character ID, fallback to userId (may not find Character)
      const adminId = grantedBy || req.user!.userId;
      const admin = await Character.findById(adminId);
      
      const grants: any[] = [];
      
      for (const characterId of characterIds) {
        const grant = new ExperienceGrant({
          characterId,
          grantedBy: adminId,
          grantedByType: 'admin',
          grantedByName: admin?.name || 'Admin',
          grantType: 'manual_master',
          category: category || 'special',
          experiencePoints: experiencePoints || 0,
          skillPoints: skillPoints || 0,
          reason,
          masterComment: comment
        });
        
        await grant.save();
        grants.push(grant);
        
        // Update progression
        await this.updateCharacterProgression(characterId, experiencePoints, skillPoints);
      }
      
      logger.info('Manual experience grant by admin', {
        adminId,
        characterIds,
        experiencePoints,
        skillPoints,
        reason
      });
      
      res.json(createResponse(
        { grants: grants.length },
        'Manual experience grants created',
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Failed to create manual experience grant', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile creare la concessione manuale',
        'MANUAL_GRANT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  // Helper Methods

  private static async updateCharacterProgression(
    characterId: any, 
    experiencePoints: number, 
    skillPoints: number,
    session?: any
  ): Promise<void> {
    let progression = await CharacterProgression.findOne({ characterId });
    
    if (!progression) {
      progression = new CharacterProgression({
        characterId,
        availableExperiencePoints: experiencePoints,
        availableSkillPoints: skillPoints,
        totalExperienceEarned: experiencePoints,
        totalSkillPointsEarned: skillPoints,
        totalExperienceSpent: 0,
        totalSkillPointsSpent: 0,
        statsImproved: [],
        skillsImproved: [],
        milestones: [],
        activityMetrics: {
          daysActive: 0,
          messagesThisWeek: 0,
          sessionsParticipated: 1,
          lastDailyGrant: null,
          lastActivityCheck: new Date(),
          consecutiveActiveDays: 0,
          longestActiveStreak: 0
        },
        recentSpending: [],
        settings: {
          autoSpendEnabled: false,
          preferredSkillCategories: [],
          spendingNotifications: true
        }
      });
    } else {
      progression!.availableExperiencePoints += experiencePoints;
      progression!.availableSkillPoints += skillPoints;
      progression!.totalExperienceEarned += experiencePoints;
      progression!.totalSkillPointsEarned += skillPoints;
      progression!.activityMetrics.sessionsParticipated++;
    }
    
    progression!.lastUpdated = new Date();
    
    if (session) {
      await progression!.save({ session });
    } else {
      await progression!.save();
    }
  }

  private static async sendSessionNotifications(sessionId: string, grants: any[]): Promise<void> {
    try {
      for (const grant of grants) {
        await redis.publish('character:session_experience', JSON.stringify({
          characterId: grant.characterId,
          sessionId,
          experiencePoints: grant.experiencePoints,
          skillPoints: grant.skillPoints,
          sessionTitle: grant.sessionDetails.sessionTitle
        }));
      }
    } catch (error: any) {
      logger.error('Failed to send session notifications', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
