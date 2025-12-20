import { Request, Response } from 'express';
import { GamingSession } from '../../../../packages/database/models/GamingSession';
import { SessionManagement } from '../../../../packages/database/models/SessionManagement';
import { SessionTemplate } from '../../../../packages/database/models/SessionTemplate';
import { Campaign } from '../../../../packages/database/models/Campaign';
import { ExperienceGrant } from '../../../../packages/database/models/ExperienceGrant';
import { CharacterProgression } from '../../../../packages/database/models/CharacterProgression';
import { Character } from '../../../../packages/database/models/Character';
import { logger } from '../utils/logger';

export class SessionManagementController {
  
  /**
   * Create new gaming session (Master only)
   * POST /game/sessions
   */
  static async createSession(req: Request, res: Response): Promise<void> {
    const masterId = req.character!.characterId;
    const masterName = req.character!.characterName;
    
    try {
      // Verify master permissions
      const master = await Character.findById(masterId);
      if (!master || !master.gameplayRoles.includes('master')) {
        res.status(403).json({
          success: false,
          error: 'Permessi di Master richiesti',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
        return;
      }
      
      const {
        title,
        description,
        sessionDate,
        estimatedDuration,
        primaryLocation,
        sessionType,
        difficultyLevel,
        maxParticipants,
        isPublic,
        templateId,
        campaignId
      } = req.body;
      
      // Load template if provided
      let templateData = null;
      if (templateId) {
        const template = await SessionTemplate.findById(templateId);
        if (!template) {
          res.status(404).json({
            success: false,
            error: 'Template sessione non trovato',
            code: 'TEMPLATE_NOT_FOUND'
          });
          return;
        }
        templateData = template;
      }
      
      // Validate campaign if provided
      let campaign = null;
      if (campaignId) {
        campaign = await Campaign.findById(campaignId);
        if (!campaign) {
          res.status(404).json({
            success: false,
            error: 'Campagna non trovata',
            code: 'CAMPAIGN_NOT_FOUND'
          });
          return;
        }
        
        // Check if master is authorized for this campaign
        if (!campaign.masterIds.includes(masterId)) {
          res.status(403).json({
            success: false,
            error: 'Non autorizzato per questa campagna',
            code: 'CAMPAIGN_ACCESS_DENIED'
          });
          return;
        }
      }
      
      // Create session
      const session = new GamingSession({
        title,
        description,
        masterId,
        masterName,
        sessionDate: new Date(sessionDate),
        startTime: new Date(sessionDate),
        estimatedDuration: estimatedDuration || templateData?.estimatedDuration || 120,
        primaryLocation,
        sessionType: sessionType || templateData?.category || 'investigation',
        difficultyLevel: difficultyLevel || templateData?.difficulty || 'medium',
        campaignId: campaign?._id,
        
        // Set experience rewards from template or defaults
        baseExperienceReward: templateData?.experienceGuidance?.baseExperienceReward || 5,
        baseSkillPointReward: templateData?.experienceGuidance?.baseSkillPointReward || 3,
        experienceMultiplier: 1.0,
        
        status: 'planned',
        participants: []
      });
      
      await session.save();
      
      // Create session management record
      const sessionMgmt = new SessionManagement({
        sessionId: session._id,
        
        // Initialize planning from template or defaults
        planning: {
          isPublic: isPublic !== undefined ? isPublic : true,
          maxParticipants: maxParticipants || templateData?.recommendedParticipants?.max || 6,
          minParticipants: templateData?.recommendedParticipants?.min || 2,
          requiresPreRegistration: true,
          registrationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          preparationNotes: templateData?.preparation?.masterPrep?.join('\n') || '',
          requiredReading: templateData?.preparation?.backgroundReading || [],
          propsNeeded: templateData?.preparation?.requiredProps || []
        },
        
        // Initialize participant management
        participantManagement: {
          registrations: [],
          waitlist: [],
          invitations: []
        },
        
        // Initialize live session tracking
        liveSession: {
          isActive: false,
          participantStatus: [],
          masterTools: {
            diceRollsEnabled: true,
            privateNotesVisible: false,
            currentMood: 'relaxed'
          },
          activityLog: []
        },
        
        // Initialize analytics
        analytics: {
          totalActiveTime: 0,
          averageParticipantEngagement: 0,
          messageCount: 0,
          diceRollCount: 0,
          sceneChanges: 0,
          characterMetrics: [],
          popularScenes: []
        }
      });
      
      await sessionMgmt.save();
      
      // Add session to campaign if specified
      if (campaign) {
        await campaign.addSession(session._id.toString());
      }
      
      // If template was used, increment usage counter
      if (templateData) {
        templateData.timesUsed++;
        await templateData.save();
      }
      
      logger.info('Gaming session created', {
        sessionId: session._id,
        masterId,
        title,
        sessionDate,
        templateUsed: !!templateId,
        campaignId: campaign?._id
      });
      
      res.json({
        success: true,
        message: 'Sessione creata con successo',
        data: { 
          sessionId: session._id,
          sessionMgmtId: sessionMgmt._id
        }
      });
      
    } catch (error: any) {
      logger.error('Session creation failed', {
        masterId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Impossibile creare la sessione',
        code: 'CREATE_SESSION_ERROR'
      });
    }
  }

  /**
   * Get master's sessions
   * GET /game/sessions
   */
  static async getMasterSessions(req: Request, res: Response): Promise<void> {
    const masterId = req.character!.characterId;
    const { status, upcoming, limit = 20, skip = 0 } = req.query;
    
    try {
      let filter: any = { masterId };
      
      if (status) {
        filter.status = status;
      }
      
      if (upcoming === 'true') {
        filter.sessionDate = { $gte: new Date() };
      }
      
      const sessions = await GamingSession.find(filter)
        .populate('primaryLocation', 'name description')
        .populate('campaignId', 'title currentChapter')
        .sort({ sessionDate: -1 })
        .limit(parseInt(limit as string))
        .skip(parseInt(skip as string));
      
      // Get session management data for each session
      const sessionIds = sessions.map(s => s._id);
      const sessionMgmts = await SessionManagement.find({ 
        sessionId: { $in: sessionIds } 
      });
      
      const sessionsWithMgmt = sessions.map(session => {
        const mgmt = sessionMgmts.find(sm => sm.sessionId.equals(session._id));
        return {
          ...session.toJSON(),
          management: mgmt || null
        };
      });
      
      const totalCount = await GamingSession.countDocuments(filter);
      
      res.json({
        success: true,
        data: {
          sessions: sessionsWithMgmt,
          pagination: {
            total: totalCount,
            limit: parseInt(limit as string),
            skip: parseInt(skip as string),
            hasMore: totalCount > parseInt(skip as string) + parseInt(limit as string)
          }
        }
      });
      
    } catch (error: any) {
      logger.error('Failed to get master sessions', {
        masterId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare le sessioni',
        code: 'GET_SESSIONS_ERROR'
      });
    }
  }

  /**
   * Join session (Player registration)
   * POST /game/sessions/:sessionId/join
   */
  static async joinSession(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;
    const characterId = req.character!.characterId;
    const characterName = req.character!.characterName;
    const { characterNotes } = req.body;
    
    try {
      const session = await GamingSession.findById(sessionId);
      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Sessione non trovata',
          code: 'SESSION_NOT_FOUND'
        });
        return;
      }
      
      const sessionMgmt = await SessionManagement.findOne({ sessionId });
      if (!sessionMgmt) {
        res.status(404).json({
          success: false,
          error: 'Dati di gestione sessione non trovati',
          code: 'SESSION_MGMT_NOT_FOUND'
        });
        return;
      }
      
      // Check if session allows registration
      if (!sessionMgmt.planning.isPublic) {
        res.status(403).json({
          success: false,
          error: 'La sessione è privata',
          code: 'PRIVATE_SESSION'
        });
        return;
      }
      
      // Check registration deadline
      if (sessionMgmt.planning.registrationDeadline && 
          new Date() > sessionMgmt.planning.registrationDeadline) {
        res.status(400).json({
          success: false,
          error: 'La scadenza per la registrazione è passata',
          code: 'REGISTRATION_CLOSED'
        });
        return;
      }
      
      // Check if already registered
      const existingRegistration = sessionMgmt.participantManagement.registrations.find(
        r => r.characterId.equals(characterId)
      );
      
      if (existingRegistration) {
        res.status(400).json({
          success: false,
          error: 'Sei già registrato per questa sessione',
          code: 'ALREADY_REGISTERED'
        });
        return;
      }
      
      // Check capacity
      const currentRegistrations = sessionMgmt.participantManagement.registrations.filter(
        r => r.status === 'registered' || r.status === 'confirmed'
      ).length;
      
      if (currentRegistrations >= (sessionMgmt.planning.maxParticipants || 6)) {
        // Add to waitlist
        sessionMgmt.participantManagement.waitlist.push({
          characterId,
          characterName,
          addedAt: new Date(),
          priority: sessionMgmt.participantManagement.waitlist.length + 1
        });
        
        await sessionMgmt.save();
        
        res.json({
          success: true,
          message: 'Aggiunto alla lista d\'attesa',
          data: { 
            status: 'waitlisted', 
            position: sessionMgmt.participantManagement.waitlist.length 
          }
        });
        return;
      }
      
      // Add registration
      sessionMgmt.participantManagement.registrations.push({
        characterId,
        characterName,
        registeredAt: new Date(),
        status: 'registered',
        characterNotes: characterNotes || ''
      });
      
      await sessionMgmt.save();
      
      // Notify master via Redis
      await this.notifyMaster(session.masterId.toString(), {
        type: 'session_registration',
        sessionId,
        characterName,
        message: `${characterName} si è registrato per la tua sessione "${session.title}"`
      });
      
      logger.info('Character registered for session', {
        sessionId,
        characterId,
        characterName
      });
      
      res.json({
        success: true,
        message: 'Registrato con successo per la sessione',
        data: { status: 'registered' }
      });
      
    } catch (error: any) {
      logger.error('Failed to join session', {
        sessionId,
        characterId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Impossibile unirsi alla sessione',
        code: 'JOIN_SESSION_ERROR'
      });
    }
  }

  /**
   * Start session (Master only)
   * POST /game/sessions/:sessionId/start
   */
  static async startSession(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;
    const masterId = req.character!.characterId;
    
    try {
      const session = await GamingSession.findOne({ 
        _id: sessionId, 
        masterId,
        status: 'planned' 
      });
      
      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Sessione non trovata o già iniziata',
          code: 'SESSION_NOT_FOUND'
        });
        return;
      }
      
      const sessionMgmt = await SessionManagement.findOne({ sessionId });
      if (!sessionMgmt) {
        res.status(404).json({
          success: false,
          error: 'Dati di gestione sessione non trovati',
          code: 'SESSION_MGMT_NOT_FOUND'
        });
        return;
      }
      
      // Update session status
      session.status = 'active';
      
      // Get confirmed participants
      const confirmedParticipants = sessionMgmt.participantManagement.registrations.filter(
        r => r.status === 'registered' || r.status === 'confirmed'
      );
      
      session.participants = confirmedParticipants.map(reg => ({
        characterId: reg.characterId,
        characterName: reg.characterName,
        joinedAt: new Date(),
        wasActive: true,
        participationScore: 5 // Default score
      }));
      
      await session.save();
      
      // Update live session tracking
      sessionMgmt.liveSession.isActive = true;
      sessionMgmt.liveSession.actualStartTime = new Date();
      
      sessionMgmt.liveSession.participantStatus = confirmedParticipants.map(reg => ({
        characterId: reg.characterId,
        isOnline: false, // Will be updated via WebSocket
        lastSeen: new Date()
      }));
      
      // Add activity log entry
      sessionMgmt.liveSession.activityLog.push({
        timestamp: new Date(),
        type: 'scene_change',
        description: 'Session started',
        data: { sceneTitle: 'Session Beginning' }
      });
      
      await sessionMgmt.save();
      
      // Notify all participants via Redis
      await this.notifySessionParticipants(sessionId, {
        type: 'session_started',
        message: 'La sessione di gioco è iniziata!',
        masterName: req.character!.characterName
      });
      
      logger.info('Gaming session started', {
        sessionId,
        masterId,
        participantCount: confirmedParticipants.length
      });
      
      res.json({
        success: true,
        message: 'Sessione iniziata con successo',
        data: {
          sessionId,
          participantCount: confirmedParticipants.length,
          startTime: sessionMgmt.liveSession.actualStartTime
        }
      });
      
    } catch (error: any) {
      logger.error('Failed to start session', {
        sessionId,
        masterId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Impossibile iniziare la sessione',
        code: 'START_SESSION_ERROR'
      });
    }
  }

  /**
   * End session and assign experience
   * POST /game/sessions/:sessionId/end
   */
  static async endSession(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;
    const masterId = req.character!.characterId;
    const { 
      sessionSummary, 
      significantEvents, 
      customExperienceGrants,
      masterNotes 
    } = req.body;
    
    try {
      const session = await GamingSession.findOne({ 
        _id: sessionId, 
        masterId,
        status: 'active' 
      });
      
      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Sessione attiva non trovata',
          code: 'SESSION_NOT_FOUND'
        });
        return;
      }
      
      const sessionMgmt = await SessionManagement.findOne({ sessionId });
      if (!sessionMgmt) {
        res.status(404).json({
          success: false,
          error: 'Dati di gestione sessione non trovati',
          code: 'SESSION_MGMT_NOT_FOUND'
        });
        return;
      }
      
      // Calculate session metrics
      const endTime = new Date();
      const sessionDuration = sessionMgmt.liveSession.actualStartTime 
        ? Math.floor((endTime.getTime() - sessionMgmt.liveSession.actualStartTime.getTime()) / (1000 * 60))
        : 0;
      
      // Update session
      session.status = 'completed';
      session.endTime = endTime;
      session.summary = sessionSummary;
      session.significantEvents = significantEvents || [];
      session.masterNotes = masterNotes;
      session.totalActiveTime = sessionDuration;
      
      await session.save();
      
      // Update session management
      sessionMgmt.liveSession.isActive = false;
      sessionMgmt.analytics.totalActiveTime = sessionDuration;
      await sessionMgmt.save();
      
      // Assign experience points
      const experienceResults = [];
      
      for (const participant of session.participants) {
        if (participant.wasActive) {
          try {
            // Check for custom experience grant for this participant
            const customGrant = customExperienceGrants?.find(
              (grant: any) => grant.characterId === participant.characterId.toString()
            );
            
            const experiencePoints = customGrant?.experiencePoints || 
              Math.round(session.baseExperienceReward * session.experienceMultiplier);
            const skillPoints = customGrant?.skillPoints || 
              Math.round(session.baseSkillPointReward * session.experienceMultiplier);
            
            // Create experience grant
            const grant = new ExperienceGrant({
              characterId: participant.characterId,
              grantedBy: masterId,
              grantedByType: 'master',
              grantedByName: req.character!.characterName,
              grantType: 'session_participation',
              category: session.sessionType,
              experiencePoints,
              skillPoints,
              reason: `Session participation: ${session.title}`,
              masterComment: customGrant?.comment || '',
              sessionId: session._id,
              sessionDetails: {
                sessionDate: session.sessionDate,
                sessionTitle: session.title,
                primaryLocation: session.primaryLocation,
                sessionType: session.sessionType,
                participants: session.participants.map(p => p.characterId),
                difficultyRating: session.difficultyLevel,
                masterNotes: session.masterNotes
              }
            });
            
            await grant.save();
            
            // Update character progression
            await this.updateCharacterProgression(
              participant.characterId.toString(),
              experiencePoints,
              skillPoints
            );
            
            session.experienceGrants.push(grant._id);
            experienceResults.push({
              characterId: participant.characterId,
              characterName: participant.characterName,
              experiencePoints,
              skillPoints,
              success: true
            });
            
          } catch (error: any) {
            experienceResults.push({
              characterId: participant.characterId,
              characterName: participant.characterName,
              success: false,
              error: error instanceof Error ? error.message : 'Grant failed'
            });
          }
        }
      }
      
      session.experienceAssigned = true;
      await session.save();
      
      // Notify participants about session end and experience
      await this.notifySessionParticipants(sessionId, {
        type: 'session_ended',
        message: 'La sessione di gioco è conclusa. I punti esperienza sono stati assegnati!',
        experienceResults
      });
      
      logger.info('Gaming session ended with experience assignment', {
        sessionId,
        masterId,
        duration: sessionDuration,
        experienceGrantsCreated: experienceResults.filter(r => r.success).length
      });
      
      res.json({
        success: true,
        message: 'Sessione terminata ed esperienza assegnata',
        data: {
          sessionId,
          duration: sessionDuration,
          experienceResults
        }
      });
      
    } catch (error: any) {
      logger.error('Session end failed', {
        sessionId,
        masterId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Impossibile terminare la sessione',
        code: 'END_SESSION_ERROR'
      });
    }
  }

  /**
   * Get public sessions (for player browsing)
   * GET /game/sessions/public
   */
  static async getPublicSessions(req: Request, res: Response): Promise<void> {
    const { category, difficulty, upcoming = 'true', limit = 20 } = req.query;
    
    try {
      let filter: any = {
        status: { $in: ['planned'] }
      };
      
      if (upcoming === 'true') {
        filter.sessionDate = { $gte: new Date() };
      }
      
      if (category) {
        filter.sessionType = category;
      }
      
      if (difficulty) {
        filter.difficultyLevel = difficulty;
      }
      
      const sessions = await GamingSession.find(filter)
        .populate('primaryLocation', 'name description')
        .populate('masterId', 'name')
        .populate('campaignId', 'title')
        .select(`
          title description sessionDate estimatedDuration sessionType difficultyLevel
          primaryLocation masterId campaignId
        `)
        .sort({ sessionDate: 1 })
        .limit(parseInt(limit as string));
      
      // Get session management data to check public status and availability
      const sessionIds = sessions.map(s => s._id);
      const sessionMgmts = await SessionManagement.find({ 
        sessionId: { $in: sessionIds },
        'planning.isPublic': true
      }).select('sessionId planning participantManagement');
      
      // Filter and enhance sessions with availability data
      const publicSessions = sessions.filter(session => {
        return sessionMgmts.some(mgmt => mgmt.sessionId.equals(session._id));
      }).map(session => {
        const mgmt = sessionMgmts.find(sm => sm.sessionId.equals(session._id))!;
        const currentRegistrations = mgmt.participantManagement.registrations.filter(
          r => r.status === 'registered' || r.status === 'confirmed'
        ).length;
        
        return {
          ...session.toJSON(),
          availability: {
            spotsAvailable: (mgmt.planning.maxParticipants || 6) - currentRegistrations,
            totalSpots: mgmt.planning.maxParticipants || 6,
            currentRegistrations,
            canRegister: currentRegistrations < (mgmt.planning.maxParticipants || 6) &&
                        (!mgmt.planning.registrationDeadline || 
                         new Date() <= mgmt.planning.registrationDeadline)
          },
          registrationDeadline: mgmt.planning.registrationDeadline
        };
      });
      
      res.json({
        success: true,
        data: { 
          sessions: publicSessions,
          count: publicSessions.length
        }
      });
      
    } catch (error: any) {
      logger.error('Failed to get public sessions', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare le sessioni pubbliche',
        code: 'GET_PUBLIC_SESSIONS_ERROR'
      });
    }
  }

  /**
   * Get session templates for master
   * GET /game/session-templates
   */
  static async getSessionTemplates(req: Request, res: Response): Promise<void> {
    const masterId = req.character!.characterId;
    const { category, difficulty, isPublic } = req.query;
    
    try {
      let filter: any = {
        $or: [
          { createdBy: masterId },
          { isPublic: true }
        ]
      };
      
      if (category) {
        filter.category = category;
      }
      
      if (difficulty) {
        filter.difficulty = difficulty;
      }
      
      if (isPublic !== undefined) {
        if (isPublic === 'true') {
          filter.isPublic = true;
          delete filter.$or;
        } else {
          filter.createdBy = masterId;
          delete filter.$or;
        }
      }
      
      const templates = await SessionTemplate.find(filter)
        .populate('createdBy', 'name')
        .sort({ averageRating: -1, timesUsed: -1 })
        .limit(50);
      
      res.json({
        success: true,
        data: { templates }
      });
      
    } catch (error: any) {
      logger.error('Failed to get session templates', {
        masterId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare i template sessione',
        code: 'GET_TEMPLATES_ERROR'
      });
    }
  }

  // Helper methods

  private static async notifyMaster(masterId: string, notification: any): Promise<void> {
    try {
      const { getRedisClient } = await import('../config/redis');
      const redis = getRedisClient();
      
      await redis.publish('master:notification', JSON.stringify({
        masterId,
        ...notification,
        timestamp: new Date().toISOString()
      }));
    } catch (error: any) {
      logger.warn('Failed to notify master', { masterId, error });
    }
  }

  private static async notifySessionParticipants(sessionId: string, notification: any): Promise<void> {
    try {
      const { getRedisClient } = await import('../config/redis');
      const redis = getRedisClient();
      
      await redis.publish('session:notification', JSON.stringify({
        sessionId,
        ...notification,
        timestamp: new Date().toISOString()
      }));
    } catch (error: any) {
      logger.warn('Failed to notify session participants', { sessionId, error });
    }
  }

  private static async updateCharacterProgression(
    characterId: string,
    experiencePoints: number,
    skillPoints: number
  ): Promise<void> {
    try {
      const progression = await CharacterProgression.findOne({ characterId });
      
      if (progression) {
        progression.availableExperiencePoints += experiencePoints;
        progression.availableSkillPoints += skillPoints;
        progression.totalExperienceEarned += experiencePoints;
        progression.totalSkillPointsEarned += skillPoints;
        progression.activityMetrics.sessionsParticipated++;
        progression.lastUpdated = new Date();
        
        await progression.save();
      }
    } catch (error: any) {
      logger.error('Failed to update character progression', {
        characterId,
        experiencePoints,
        skillPoints,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}