import { Request, Response } from 'express';
import { GamingSession } from '@database/models/GamingSession';
import { SessionManagement } from '@database/models/SessionManagement';
import { SessionTemplate } from '@database/models/SessionTemplate';
import { Character } from '@database/models/Character';
import { logger } from '../logger';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '@shared/utils/apiResponse';


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
        res.status(403).json(errorResponse(
          'Permessi di Master richiesti',
          'INSUFFICIENT_PERMISSIONS',
          undefined,
          403,
          getRequestId(req)
        ));
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
        templateId
      } = req.body;
      
      // Load template if provided
      let templateData = null;
      if (templateId) {
        const template = await SessionTemplate.findById(templateId);
        if (!template) {
          res.status(404).json(errorResponse(
            'Template sessione non trovato',
            'TEMPLATE_NOT_FOUND',
            undefined,
            404,
            getRequestId(req)
          ));
          return;
        }
        templateData = template;
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
        templateUsed: !!templateId
      });
      
      res.json(createResponse(
        { 
          sessionId: session._id,
          sessionMgmtId: sessionMgmt._id
        },
        'Sessione creata con successo',
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Session creation failed', {
        masterId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile creare la sessione',
        'CREATE_SESSION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
      
      res.json(listResponse(
        sessionsWithMgmt,
        {
          currentPage: Math.floor(parseInt(skip as string) / parseInt(limit as string)) + 1,
          pageSize: parseInt(limit as string),
        totalItems: totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit as string)),
          hasNextPage: totalCount > parseInt(skip as string) + parseInt(limit as string),
          hasPreviousPage: parseInt(skip as string) > 0
        },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Failed to get master sessions', {
        masterId,
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
   * Join session (Player registration)
   * POST /game/sessions/:sessionId/join
   */
  static async joinSession(req: Request<{ sessionId: string }>, res: Response): Promise<void> {
    const { sessionId } = req.params;
    const characterId = req.character!.characterId;
    const characterName = req.character!.characterName;
    const { characterNotes } = req.body;
    
    try {
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
      
      const sessionMgmt = await SessionManagement.findOne({ sessionId });
      if (!sessionMgmt) {
        res.status(404).json(errorResponse(
          'Dati di gestione sessione non trovati',
          'SESSION_MGMT_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }
      
      // Check if session allows registration
      if (!sessionMgmt.planning.isPublic) {
        res.status(403).json(errorResponse(
          'La sessione è privata',
          'PRIVATE_SESSION',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }
      
      // Check registration deadline
      if (sessionMgmt.planning.registrationDeadline && 
          new Date() > sessionMgmt.planning.registrationDeadline) {
        res.status(400).json(errorResponse(
          'La scadenza per la registrazione è passata',
          'REGISTRATION_CLOSED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }
      
      // Check if already registered
      const existingRegistration = sessionMgmt.participantManagement.registrations.find(
        (r: any) => r.characterId.equals(characterId)
      );
      
      if (existingRegistration) {
        res.status(400).json(errorResponse(
          'Sei già registrato per questa sessione',
          'ALREADY_REGISTERED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }
      
      // Check capacity
      const currentRegistrations = sessionMgmt.participantManagement.registrations.filter(
        (r: any) => r.status === 'registered' || r.status === 'confirmed'
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
        
        res.json(successResponse(
          { 
            status: 'waitlisted', 
            position: sessionMgmt.participantManagement.waitlist.length 
          },
          'Aggiunto alla lista d\'attesa',
          getRequestId(req)
        ));
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
      
      res.json(successResponse(
        { status: 'registered' },
        'Registrato con successo per la sessione',
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Failed to join session', {
        sessionId,
        characterId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile unirsi alla sessione',
        'JOIN_SESSION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Start session (Master only)
   * POST /game/sessions/:sessionId/start
   */
  static async startSession(req: Request<{ sessionId: string }>, res: Response): Promise<void> {
    const { sessionId } = req.params;
    const masterId = req.character!.characterId;
    
    try {
      const session = await GamingSession.findOne({ 
        _id: sessionId, 
        masterId,
        status: 'planned' 
      });
      
      if (!session) {
        res.status(404).json(errorResponse(
          'Sessione non trovata o già iniziata',
          'SESSION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }
      
      const sessionMgmt = await SessionManagement.findOne({ sessionId });
      if (!sessionMgmt) {
        res.status(404).json(errorResponse(
          'Dati di gestione sessione non trovati',
          'SESSION_MGMT_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }
      
      // Update session status
      session.status = 'active';
      
      // Get confirmed participants
      const confirmedParticipants = sessionMgmt.participantManagement.registrations.filter(
        (r: any) => r.status === 'registered' || r.status === 'confirmed'
      );

      session.participants = confirmedParticipants.map((reg: any) => ({
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

      sessionMgmt.liveSession.participantStatus = confirmedParticipants.map((reg: any) => ({
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
      
      res.json(successResponse(
        {
          sessionId,
          participantCount: confirmedParticipants.length,
          startTime: sessionMgmt.liveSession.actualStartTime
        },
        'Sessione iniziata con successo',
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Failed to start session', {
        sessionId,
        masterId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile iniziare la sessione',
        'START_SESSION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
        .select(`
          title description sessionDate estimatedDuration sessionType difficultyLevel
          title description sessionDate estimatedDuration sessionType difficultyLevel
          primaryLocation masterId
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
          (r: any) => r.status === 'registered' || r.status === 'confirmed'
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
      
      res.json(successResponse(
        { 
          sessions: publicSessions,
          count: publicSessions.length
        },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Failed to get public sessions', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare le sessioni pubbliche',
        'GET_PUBLIC_SESSIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
      
      res.json(successResponse(
        { templates },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Failed to get session templates', {
        masterId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare i template sessione',
        'GET_TEMPLATES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  // Helper methods

  private static async notifyMaster(masterId: string, notification: any): Promise<void> {
    try {
      const { redis } = await import('@config/runtime');
      const redisClient = redis.getClient();
      
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
      const { redis } = await import('@config/runtime');
      
      await redis.publish('session:notification', JSON.stringify({
        sessionId,
        ...notification,
        timestamp: new Date().toISOString()
      }));
    } catch (error: any) {
      logger.warn('Failed to notify session participants', { sessionId, error });
    }
  }

  /**
   * Initialize turn order for a session
   * POST /game/sessions/:sessionId/initialize-turns
   */
  static async initializeTurns(req: Request<{ sessionId: string }>, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { locationId } = req.body;

      if (!locationId) {
        res.status(400).json(errorResponse(
          'locationId is required',
          'MISSING_PARAMETER',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const { turnManager } = await import('../services/TurnManager');
      const turnInfo = await turnManager.initializeTurnOrder(sessionId, locationId);

      if (!turnInfo) {
        res.status(404).json(errorResponse(
          'Failed to initialize turn order',
          'INITIALIZATION_FAILED',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      logger.info(`[SessionManagement] Turn order initialized for session ${sessionId}`);

      res.json({ success: true, data: turnInfo });

    } catch (error: any) {
      logger.error('Initialize turns error:', error);
      res.status(500).json(errorResponse(
        'Failed to initialize turns',
        'TURN_INIT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Complete bot turn (called by local-ai via AI gateway)
   * POST /game/sessions/:sessionId/complete-bot-turn
   * Requires AI_GATEWAY_WEBHOOK_SECRET authentication
   */
  static async completeBotTurn(req: Request<{ sessionId: string }>, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const { turnManager } = await import('../services/TurnManager');
      await turnManager.completeBotTurn(sessionId);

      // Get next turn info
      const nextTurn = await turnManager.getCurrentTurnInfo(sessionId);

      // Emit WebSocket event for turn advancement
      const io = req.app.get('io');
      if (io && nextTurn) {
        // Find location associated with session
        const session = await GamingSession.findById(sessionId);
        if (session) {
          const roomName = `location_${session.primaryLocation}`;
          io.to(roomName).emit('turn_advanced', {
            locationId: session.primaryLocation.toString(),
            sessionId,
            currentCharacterId: nextTurn.currentCharacterId,
            currentCharacterName: nextTurn.currentCharacterName,
            isBot: nextTurn.isBot,
            turnIndex: nextTurn.currentTurnIndex
          });
        }
      }

      logger.info(`[SessionManagement] Bot turn completed for session ${sessionId}`);

      res.json(successResponse({ turnCompleted: true, nextTurn }, undefined, getRequestId(req)));

    } catch (error: any) {
      logger.error('Complete bot turn error:', error);
      res.status(500).json(errorResponse(
        'Failed to complete bot turn',
        'BOT_TURN_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get current turn info for a session
   * GET /game/sessions/:sessionId/turn-info
   */
  static async getTurnInfo(req: Request<{ sessionId: string }>, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const { turnManager } = await import('../services/TurnManager');
      const turnInfo = await turnManager.getCurrentTurnInfo(sessionId);

      if (!turnInfo) {
        res.status(404).json(errorResponse(
          'No turn info available for this session',
          'TURN_INFO_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      res.json({ success: true, data: turnInfo });

    } catch (error: any) {
      logger.error('Get turn info error:', error);
      res.status(500).json(errorResponse(
        'Failed to get turn info',
        'TURN_INFO_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/sessions/:sessionId
   * Get session details (for bot integration)
   */
  static async getSession(req: Request<{ sessionId: string }>, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json(errorResponse(
          'Session ID is required',
          'INVALID_REQUEST',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const session = await GamingSession.findById(sessionId);

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

      res.json(successResponse(
        { session },
        'Session retrieved successfully',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Get session error:', error);
      res.status(500).json(errorResponse(
        'Failed to get session',
        'GET_SESSION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * PATCH /game/sessions/:sessionId
   * Update session fields (for bot integration)
   */
  static async updateSession(req: Request<{ sessionId: string }>, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const updateData = req.body;

      if (!sessionId) {
        res.status(400).json(errorResponse(
          'Session ID is required',
          'INVALID_REQUEST',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Prepare update object for findByIdAndUpdate
      const updateFields: any = {};

      // Update allowed fields
      if (updateData.botCharacterId !== undefined) {
        updateFields.botCharacterId = updateData.botCharacterId;
      }

      // Handle botTagAssignments updates (dot notation support)
      Object.keys(updateData).forEach(key => {
        if (key.startsWith('botTagAssignments.')) {
          const tag = key.replace('botTagAssignments.', '');
          updateFields[`botTagAssignments.${tag}`] = updateData[key];
        }
      });

      // Use findByIdAndUpdate to bypass full document validation (partial update)
      const session = await GamingSession.findByIdAndUpdate(
        sessionId,
        { $set: updateFields },
        {
          returnDocument: 'after',
          runValidators: false // Skip validation for partial updates
        }
      );

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

      logger.info(`[SessionManagement] Session ${sessionId} updated`, {
        updates: Object.keys(updateData)
      });

      res.json(successResponse(
        { session },
        'Session updated successfully',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Update session error:', error);
      res.status(500).json(errorResponse(
        'Failed to update session',
        'UPDATE_SESSION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}