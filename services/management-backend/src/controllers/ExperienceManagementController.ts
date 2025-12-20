import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { 
  ExperienceGrant, 
  CharacterProgression, 
  GamingSession, 
  Character 
} from '../../../../packages/database/models';
import { logger } from '../utils/logger';

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
      
      res.json({
        success: true,
        data: {
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
            limit: parseInt(limit as string),
            totalGrants: grantsCount
          }
        }
      });
      
    } catch (error: any) {
      logger.error('Failed to get experience overview', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare la panoramica esperienza',
        code: 'EXPERIENCE_OVERVIEW_ERROR'
      });
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
      
      res.json({
        success: true,
        data: {
          sessions,
          statistics: sessionStats,
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total: totalCount
          }
        }
      });
      
    } catch (error: any) {
      logger.error('Failed to get sessions overview', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare la panoramica sessioni',
        code: 'SESSIONS_OVERVIEW_ERROR'
      });
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
        res.status(400).json({
          success: false,
          error: 'Master specificato non valido',
          code: 'INVALID_MASTER'
        });
        return;
      }
      
      // Verify participants exist
      const participants = await Character.find({
        _id: { $in: participantIds },
        status: 'APPROVED'
      });
      
      if (participants.length !== participantIds.length) {
        res.status(400).json({
          success: false,
          error: 'Alcuni partecipanti non sono validi o non approvati',
          code: 'INVALID_PARTICIPANTS'
        });
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
      
      res.json({
        success: true,
        message: 'Gaming session created successfully',
        data: { sessionId: session._id, session }
      });
      
    } catch (error: any) {
      logger.error('Failed to create gaming session', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Impossibile creare la sessione di gioco',
        code: 'CREATE_SESSION_ERROR'
      });
    }
  }

  /**
   * Update gaming session
   * PUT /admin/experience/sessions/:sessionId
   */
  static async updateGamingSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const updates = req.body;
      
      const session = await GamingSession.findByIdAndUpdate(
        sessionId,
        { ...updates, updatedAt: new Date() },
        { new: true, runValidators: true }
      );
      
      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Sessione di gioco non trovata',
          code: 'SESSION_NOT_FOUND'
        });
        return;
      }
      
      logger.info('Gaming session updated', {
        sessionId,
        updates: Object.keys(updates)
      });
      
      res.json({
        success: true,
        message: 'Gaming session updated successfully',
        data: { session }
      });
      
    } catch (error: any) {
      logger.error('Failed to update gaming session', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Impossibile aggiornare la sessione di gioco',
        code: 'UPDATE_SESSION_ERROR'
      });
    }
  }

  /**
   * Assign experience from completed session
   * POST /admin/experience/sessions/:sessionId/assign-experience
   */
  static async assignSessionExperience(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { participantScores, masterComment, skipNotifications } = req.body;
      
      const session = await GamingSession.findById(sessionId)
        .populate('participants.characterId')
        .populate('masterId');
        
      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Sessione di gioco non trovata',
          code: 'SESSION_NOT_FOUND'
        });
        return;
      }
      
      if (session.experienceAssigned) {
        res.status(400).json({
          success: false,
          error: 'Esperienza già assegnata a questa sessione',
          code: 'EXPERIENCE_ALREADY_ASSIGNED'
        });
        return;
      }
      
      if (session.status !== 'completed') {
        res.status(400).json({
          success: false,
          error: 'La sessione deve essere completata prima di assegnare esperienza',
          code: 'SESSION_NOT_COMPLETED'
        });
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
      
      res.json({
        success: true,
        message: 'Experience assigned successfully',
        data: {
          grantsCreated: grants.length,
          grants: grants.map(g => ({
            characterId: g.characterId,
            experiencePoints: g.experiencePoints,
            skillPoints: g.skillPoints
          }))
        }
      });
      
    } catch (error: any) {
      logger.error('Failed to assign session experience', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Impossibile assegnare esperienza di sessione',
        code: 'ASSIGN_EXPERIENCE_ERROR'
      });
    }
  }

  /**
   * Get character progression details (admin view)
   * GET /admin/experience/characters/:characterId/progression
   */
  static async getCharacterProgressionDetails(req: Request, res: Response): Promise<void> {
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
        res.status(404).json({
          success: false,
          error: 'Personaggio non trovato',
          code: 'CHARACTER_NOT_FOUND'
        });
        return;
      }
      
      res.json({
        success: true,
        data: {
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
        }
      });
      
    } catch (error: any) {
      logger.error('Failed to get character progression details', {
        characterId: req.params.characterId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare i dettagli di progressione del personaggio',
        code: 'PROGRESSION_DETAILS_ERROR'
      });
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
      const adminId = req.user!.characterId || grantedBy;
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
      
      res.json({
        success: true,
        message: 'Manual experience grants created',
        data: { grants: grants.length }
      });
      
    } catch (error: any) {
      logger.error('Failed to create manual experience grant', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Impossibile creare la concessione manuale',
        code: 'MANUAL_GRANT_ERROR'
      });
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
      const { getRedisClient } = await import('../config/redis');
      const redis = getRedisClient();
      
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