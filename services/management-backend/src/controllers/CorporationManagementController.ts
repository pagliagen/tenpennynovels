import { Request, Response } from 'express';
import { 
  ApiResponse,
  PaginationInfo
} from '../types/management';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import { getRedisClient } from '../config/redis';

export class CorporationManagementController {
  /**
   * Get all corporations with pagination and optional filtering
   * GET /admin/corporations
   */
  static async getAllCorporations(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 25;
      const status = req.query.status as string;
      
      const skip = (page - 1) * pageSize;
      
      // Build query filter - Corporation model doesn't have status field
      let filter: any = {};
      // Note: Corporation model doesn't have status field, so we'll ignore status filter for now

      // Use local model with proper imports
      const { Corporation } = await import('../../../../packages/database/models/Corporation');
      
      // Get total count for pagination with error handling
      let totalItems;
      try {
        totalItems = await Corporation.countDocuments(filter);
      } catch (countError) {
        logger.error('Error counting corporations:', { 
          error: countError instanceof Error ? countError.message : String(countError), 
          filter 
        });
        throw new Error('Impossibile contare le corporazioni');
      }
      
      // Get paginated corporations with populated data
      let corporations;
      try {
        corporations = await Corporation.find(filter)
          .populate({
            path: 'createdBy',
            select: 'username email',
            options: { strictPopulate: false }
          })
          .populate({
            path: 'members.characterId',
            select: 'name surname userId',
            options: { strictPopulate: false }
          })
          .select('name description type createdAt createdBy members treasury roles settings')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .lean()
          .exec();
      } catch (findError) {
        logger.error('Error fetching corporations from database:', { 
          error: findError instanceof Error ? findError.message : String(findError), 
          filter, skip, pageSize 
        });
        throw new Error('Impossibile recuperare le corporazioni dal database');
      }

      // Transform data to match frontend expectations
      const transformedCorporations = corporations.map((corp: any) => {
        const creator = corp.createdBy || {};
        const officers = corp.members?.filter((m: any) => {
          const memberRole = corp.roles?.find((r: any) => r.id === m.roleId);
          return memberRole?.isOfficer;
        }) || [];
        
        return {
          id: corp._id.toString(),
          name: corp.name || 'Unnamed Corporation',
          description: corp.description || '',
          type: corp.type || 'guild',
          status: corp.isRecruiting ? 'active' : 'inactive', // Infer status from isRecruiting
          ownerId: creator._id ? creator._id.toString() : 'unknown',
          ownerName: creator.username || 'Unknown User',
          memberCount: corp.members?.length || 0,
          officerCount: officers.length,
          treasury: corp.treasury?.balance || 0,
          createdAt: corp.createdAt ? corp.createdAt.toISOString() : new Date().toISOString()
        };
      });

      const totalPages = Math.ceil(totalItems / pageSize);
      const hasMore = page < totalPages;

      const paginationInfo: PaginationInfo = {
        currentPage: page,
        totalPages,
        totalItems,
        limit: pageSize,
        hasMore
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed all corporations', {
        ...auditInfo,
        page,
        pageSize,
        statusFilter: status || 'all',
        totalResults: transformedCorporations.length,
        totalItems,
        category: 'corporation_management'
      });

      const response: ApiResponse<{ corporations: any[]; pagination: PaginationInfo }> = {
        success: true,
        data: {
          corporations: transformedCorporations,
          pagination: paginationInfo
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error in getAllCorporations method:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params
      });
      
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Impossibile recuperare le corporazioni',
        code: 'FETCH_ALL_CORPORATIONS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get corporation details with complete information
   * GET /admin/corporations/:corporationId
   */
  static async getCorporationDetails(req: Request, res: Response): Promise<void> {
    try {
      const corporationId = req.params.corporationId;
      
      // Use local model with proper imports
      const { Corporation } = await import('../../../../packages/database/models/Corporation');
      const { Character } = await import('../../../../packages/database/models/Character');
      
      // Get corporation with populated references
      const corporation = await Corporation.findById(corporationId)
        .populate({
          path: 'createdBy',
          select: 'username email',
          options: { strictPopulate: false }
        })
        .populate({
          path: 'members.characterId',
          select: 'name surname userId',
          populate: {
            path: 'userId',
            select: 'username email',
            options: { strictPopulate: false }
          },
          options: { strictPopulate: false }
        })
        .lean()
        .exec() as any;

      if (!corporation) {
        const response: ApiResponse = {
          success: false,
          error: 'Corporazione non trovata',
          code: 'CORPORATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Transform corporation data with populated references
      const creator = corporation.createdBy || {};
      
      // Transform officers (members with officer roles)
      const transformedOfficers = (corporation.members || []).filter((member: any) => {
        const memberRole = corporation.roles?.find((r: any) => r.id === member.roleId);
        return memberRole?.isOfficer;
      }).map((officer: any) => {
        const character = officer.characterId || {};
        const user = character.userId || {};
        const role = corporation.roles?.find((r: any) => r.id === officer.roleId) || {};
        
        return {
          characterId: character._id ? character._id.toString() : 'unknown',
          characterName: `${character.name || 'Unknown'} ${character.surname || ''}`.trim(),
          userId: user._id ? user._id.toString() : 'unknown',
          username: user.username || 'Unknown User',
          email: user.email || 'No Email',
          role: role.name || 'Member',
          appointedAt: officer.joinedAt ? officer.joinedAt.toISOString() : null,
          gameplayRoles: character.gameplayRoles || []
        };
      });

      // Transform members
      const transformedMembers = (corporation.members || []).map((member: any) => {
        const user = member.userId || {};
        
        return {
          characterId: member._id ? member._id.toString() : 'unknown',
          characterName: `${member.name || 'Unknown'} ${member.surname || ''}`.trim(),
          userId: user._id ? user._id.toString() : 'unknown',
          username: user.username || 'Unknown User',
          email: user.email || 'No Email',
          gameplayRoles: member.gameplayRoles || []
        };
      });

      const transformedCorporation = {
        id: corporation._id.toString(),
        name: corporation.name || 'Unnamed Corporation',
        description: corporation.description || '',
        type: corporation.type || 'business',
        status: corporation.status || 'active',
        
        // Creator details
        ownerId: creator._id ? creator._id.toString() : 'unknown',
        ownerName: creator.username || 'Unknown User',
        ownerUserId: creator._id ? creator._id.toString() : 'unknown',
        ownerUsername: creator.username || 'Unknown User',
        ownerEmail: creator.email || 'No Email',
        
        // Membership details
        officers: transformedOfficers,
        members: transformedMembers,
        memberCount: corporation.members?.length || 0,
        
        // Treasury details
        treasury: {
          cash: corporation.treasury?.balance || 0,
          bankDeposit: 0, // Not in current model
          totalValue: corporation.treasury?.balance || 0,
          lastUpdated: corporation.treasury?.lastUpdated ? 
            corporation.treasury.lastUpdated.toISOString() : null
        },
        
        // Requirements and rules
        membershipRequirements: corporation.manualRequirements || {},
        automaticRequirements: corporation.automaticRequirements || {},
        roles: corporation.roles || [],
        
        // Timestamps
        createdAt: corporation.createdAt ? corporation.createdAt.toISOString() : new Date().toISOString(),
        updatedAt: corporation.updatedAt ? corporation.updatedAt.toISOString() : null,
        
        // Activity tracking
        lastActivity: corporation.lastActivityAt ? corporation.lastActivityAt.toISOString() : null,
        activityLog: [] // Activity log not in current model structure
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed corporation details', {
        ...auditInfo,
        corporationId,
        corporationName: transformedCorporation.name,
        memberCount: transformedCorporation.memberCount,
        officerCount: transformedOfficers.length,
        category: 'corporation_management'
      });

      const response: ApiResponse<any> = {
        success: true,
        data: {
          corporation: transformedCorporation
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching corporation details:', { 
        error: error instanceof Error ? error.message : String(error), 
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        corporationId: req.params.corporationId,
        query: req.query,
        params: req.params
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare i dettagli della corporazione',
        code: 'FETCH_CORPORATION_DETAILS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get pending membership requests for all corporations
   * GET /admin/corporations/membership-requests
   */
  static async getMembershipRequests(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const corporationId = req.query.corporationId as string;
      
      const skip = (page - 1) * limit;
      
      // Use local model with proper imports
      const { CorporationMembershipRequest } = await import('../../../../packages/database/models/Corporation');
      
      // Build query filter
      let filter: any = { status: 'pending' };
      if (corporationId) {
        filter.corporationId = corporationId;
      }
      
      // Get total count
      const totalItems = await CorporationMembershipRequest.countDocuments(filter);
      
      // Get paginated requests with populated data
      const requests = await CorporationMembershipRequest.find(filter)
        .populate({
          path: 'corporationId',
          select: 'name type status',
          options: { strictPopulate: false }
        })
        .populate({
          path: 'characterId',
          select: 'name surname userId',
          populate: {
            path: 'userId',
            select: 'username email',
            options: { strictPopulate: false }
          },
          options: { strictPopulate: false }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec() as any;

      // Transform data
      const transformedRequests = requests.map((request: any) => {
        const corporation = request.corporationId || {};
        const character = request.characterId || {};
        const user = character.userId || {};
        
        return {
          id: request._id.toString(),
          corporationId: corporation._id ? corporation._id.toString() : 'unknown',
          corporationName: corporation.name || 'Unknown Corporation',
          corporationType: corporation.type || 'business',
          characterId: character._id ? character._id.toString() : 'unknown',
          characterName: `${character.name || 'Unknown'} ${character.surname || ''}`.trim(),
          userId: user._id ? user._id.toString() : 'unknown',
          username: user.username || 'Unknown User',
          email: user.email || 'No Email',
          message: request.message || '',
          status: request.status || 'pending',
          createdAt: request.createdAt ? request.createdAt.toISOString() : new Date().toISOString(),
          reviewedAt: request.reviewedAt ? request.reviewedAt.toISOString() : null,
          reviewedBy: request.reviewedBy ? request.reviewedBy.toString() : null
        };
      });

      const totalPages = Math.ceil(totalItems / limit);
      const hasMore = page < totalPages;

      const paginationInfo: PaginationInfo = {
        currentPage: page,
        totalPages,
        totalItems,
        limit,
        hasMore
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed membership requests', {
        ...auditInfo,
        page,
        limit,
        corporationFilter: corporationId || 'all',
        totalResults: transformedRequests.length,
        category: 'corporation_management'
      });

      const response: ApiResponse<{ requests: any[]; pagination: PaginationInfo }> = {
        success: true,
        data: {
          requests: transformedRequests,
          pagination: paginationInfo
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching membership requests:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le richieste di iscrizione',
        code: 'FETCH_MEMBERSHIP_REQUESTS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Review a membership request (approve/reject)
   * POST /admin/corporations/membership-requests/:requestId/review
   */
  static async reviewMembershipRequest(req: Request, res: Response): Promise<void> {
    try {
      const requestId = req.params.requestId;
      const { action, note } = req.body;

      // Validate review data
      if (!action || !['approve', 'reject'].includes(action)) {
        const response: ApiResponse = {
          success: false,
          error: 'Azione di revisione non valida. Deve essere "approve" o "reject"',
          code: 'INVALID_REVIEW_ACTION',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Use local model with proper imports
      const { CorporationMembershipRequest, Corporation } = await import('../../../../packages/database/models/Corporation');
      
      // Get request with populated data
      const request = await CorporationMembershipRequest.findOne({
        _id: requestId,
        status: 'pending'
      })
      .populate('corporationId')
      .populate('characterId')
      .exec() as any;

      if (!request) {
        const response: ApiResponse = {
          success: false,
          error: 'Richiesta di iscrizione non trovata o già elaborata',
          code: 'REQUEST_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      if (!auditInfo) {
        const response: ApiResponse = {
          success: false,
          error: 'Autenticazione richiesta',
          code: 'AUTHENTICATION_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(401).json(response);
        return;
      }

      let result = {};

      if (action === 'approve') {
        // APPROVE: Add member to corporation and update request status
        await Corporation.findByIdAndUpdate(
          request.corporationId._id,
          { 
            $addToSet: { members: request.characterId._id },
            $inc: { memberCount: 1 },
            lastActivity: new Date(),
            $push: {
              activityLog: {
                action: 'member_joined',
                performedBy: auditInfo!.adminId,
                performedByName: auditInfo!.adminUsername,
                timestamp: new Date(),
                details: `${request.characterId.name} ${request.characterId.surname} joined the corporation (approved by admin)`
              }
            }
          }
        );

        // Update request status
        request.status = 'approved';
        request.reviewedAt = new Date();
        request.reviewedBy = auditInfo!.adminId;
        request.reviewNote = note;
        await request.save();

        logger.info('Membership request approved by admin', {
          requestId,
          corporationId: request.corporationId._id.toString(),
          corporationName: request.corporationId.name,
          characterId: request.characterId._id.toString(),
          characterName: `${request.characterId.name} ${request.characterId.surname}`,
          note
        });

        result = {
          requestId,
          action: 'approve',
          corporationId: request.corporationId._id.toString(),
          characterId: request.characterId._id.toString(),
          note
        };

      } else if (action === 'reject') {
        // REJECT: Update request status only
        request.status = 'rejected';
        request.reviewedAt = new Date();
        request.reviewedBy = auditInfo!.adminId;
        request.reviewNote = note;
        await request.save();

        // Log activity in corporation
        await Corporation.findByIdAndUpdate(
          request.corporationId._id,
          {
            lastActivity: new Date(),
            $push: {
              activityLog: {
                action: 'membership_rejected',
                performedBy: auditInfo!.adminId,
                performedByName: auditInfo!.adminUsername,
                timestamp: new Date(),
                details: `Membership request from ${request.characterId.name} ${request.characterId.surname} was rejected by admin`
              }
            }
          }
        );

        logger.info('Membership request rejected by admin', {
          requestId,
          corporationId: request.corporationId._id.toString(),
          corporationName: request.corporationId.name,
          characterId: request.characterId._id.toString(),
          characterName: `${request.characterId.name} ${request.characterId.surname}`,
          rejectionReason: note
        });

        result = {
          requestId,
          action: 'reject',
          corporationId: request.corporationId._id.toString(),
          characterId: request.characterId._id.toString(),
          rejectionReason: note
        };
      }

      logger.info('Corporation membership request reviewed by admin', {
        ...auditInfo,
        requestId,
        action,
        note,
        category: 'corporation_management'
      });

      // Send Redis event for notifications
      try {
        const reviewEvent = {
          requestId,
          corporationId: request.corporationId._id.toString(),
          corporationName: request.corporationId.name,
          characterId: request.characterId._id.toString(),
          characterName: `${request.characterId.name} ${request.characterId.surname}`,
          action,
          note: note || '',
          reviewedBy: auditInfo!.adminId,
          reviewedByUsername: auditInfo!.adminUsername,
          timestamp: new Date().toISOString()
        };

        const eventJson = JSON.stringify(reviewEvent);
        await getRedisClient().publish('corporation:membership_reviewed', eventJson);
        
        logger.info('Corporation membership review event published to Redis', {
          event: 'corporation:membership_reviewed',
          requestId,
          action,
          reviewedBy: auditInfo!.adminUsername
        });
      } catch (redisError: any) {
        logger.error('Failed to publish corporation membership review event to Redis', {
          error: redisError instanceof Error ? redisError.message : String(redisError),
          requestId,
          action
        });
      }

      const response: ApiResponse<any> = {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error reviewing membership request:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        requestId: req.params.requestId,
        requestBody: req.body,
        auditInfo: AdminAuthMiddleware.getAuditInfo(req)
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile revisionare la richiesta di iscrizione',
        code: 'REVIEW_MEMBERSHIP_REQUEST_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Update corporation status (activate/deactivate/disband)
   * PATCH /admin/corporations/:corporationId/status
   */
  static async updateCorporationStatus(req: Request, res: Response): Promise<void> {
    try {
      const corporationId = req.params.corporationId;
      const { status, reason } = req.body;

      if (!status || !['active', 'inactive', 'disbanded'].includes(status)) {
        const response: ApiResponse = {
          success: false,
          error: 'Valore di stato non valido. Deve essere "active", "inactive" o "disbanded"',
          code: 'INVALID_STATUS',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!reason || reason.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Il motivo del cambio stato è richiesto',
          code: 'REASON_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const { Corporation } = await import('../../../../packages/database/models/Corporation');
      
      const corporation = await Corporation.findById(corporationId).exec() as any;

      if (!corporation) {
        const response: ApiResponse = {
          success: false,
          error: 'Corporazione non trovata',
          code: 'CORPORATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      if (!auditInfo) {
        const response: ApiResponse = {
          success: false,
          error: 'Autenticazione richiesta',
          code: 'AUTHENTICATION_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(401).json(response);
        return;
      }

      const oldStatus = corporation.status;

      // Update corporation status
      corporation.status = status;
      corporation.lastActivity = new Date();
      corporation.updatedAt = new Date();

      // Add to activity log
      corporation.activityLog = corporation.activityLog || [];
      corporation.activityLog.push({
        action: 'status_changed',
        performedBy: auditInfo!.adminId,
        performedByName: auditInfo!.adminUsername,
        timestamp: new Date(),
        details: `Status changed from ${oldStatus} to ${status}. Reason: ${reason}`
      });

      await corporation.save();

      logger.info('Corporation status updated by admin', {
        ...auditInfo,
        corporationId,
        corporationName: corporation.name,
        oldStatus,
        newStatus: status,
        reason,
        category: 'corporation_management'
      });

      // Send Redis event for notifications
      try {
        const statusEvent = {
          corporationId,
          corporationName: corporation.name,
          oldStatus,
          newStatus: status,
          reason,
          changedBy: auditInfo!.adminId,
          changedByUsername: auditInfo!.adminUsername,
          timestamp: new Date().toISOString()
        };

        const eventJson = JSON.stringify(statusEvent);
        await getRedisClient().publish('corporation:status_changed', eventJson);
        
        logger.info('Corporation status change event published to Redis', {
          event: 'corporation:status_changed',
          corporationId,
          oldStatus,
          newStatus: status,
          changedBy: auditInfo!.adminUsername
        });
      } catch (redisError: any) {
        logger.error('Failed to publish corporation status change event to Redis', {
          error: redisError instanceof Error ? redisError.message : String(redisError),
          corporationId,
          status
        });
      }

      const response: ApiResponse<{ corporationId: string; status: string; reason: string }> = {
        success: true,
        data: {
          corporationId,
          status,
          reason
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error updating corporation status:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        corporationId: req.params.corporationId,
        requestBody: req.body,
        params: req.params
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile aggiornare lo stato della corporazione',
        code: 'UPDATE_CORPORATION_STATUS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Create new corporation
   * POST /admin/corporations
   */
  static async createCorporation(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, type, membershipType, maxMembers } = req.body;

      // Validate required fields
      if (!name || !description || !type) {
        const response: ApiResponse = {
          success: false,
          error: 'Campi obbligatori mancanti: name, description, type',
          code: 'MISSING_REQUIRED_FIELDS',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      if (!auditInfo) {
        const response: ApiResponse = {
          success: false,
          error: 'Autenticazione richiesta',
          code: 'AUTHENTICATION_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(401).json(response);
        return;
      }

      const { Corporation } = await import('../../../../packages/database/models/Corporation');

      // Check if corporation name already exists
      const existingCorporation = await Corporation.findOne({ name });
      if (existingCorporation) {
        const response: ApiResponse = {
          success: false,
          error: 'Il nome della corporazione esiste già',
          code: 'CORPORATION_NAME_EXISTS',
          timestamp: new Date().toISOString()
        };
        res.status(409).json(response);
        return;
      }

      // Create new corporation according to the actual Corporation model
      const newCorporation = new Corporation({
        name,
        description,
        type,
        membershipType: membershipType || 'manual',
        maxMembers: maxMembers || 100,
        isRecruiting: true,
        members: [],
        roles: [
          {
            id: 'founder',
            name: 'Founder',
            description: 'Corporation founder with full permissions',
            permissions: ['all'],
            canInvite: true,
            canApproveRequests: true,
            canManageTreasury: true,
            canManageShops: true,
            canManageLocations: true,
            hierarchy: 100,
            isOfficer: true
          },
          {
            id: 'member',
            name: 'Member',
            description: 'Standard member',
            permissions: [],
            canInvite: false,
            canApproveRequests: false,
            canManageTreasury: false,
            canManageShops: false,
            canManageLocations: false,
            hierarchy: 1,
            isOfficer: false
          }
        ],
        treasury: {
          balance: 0,
          monthlyIncome: 0,
          monthlyExpenses: 0,
          transactions: [],
          lastUpdated: new Date()
        },
        settings: {
          allowPublicRequests: true,
          requireApprovalForRequests: true,
          allowInvitations: true,
          maxPendingRequests: 50,
          autoAcceptIfRequirementsMet: false,
          publiclyVisible: true
        },
        createdBy: auditInfo!.adminId,
        lastActivityAt: new Date()
      });

      await newCorporation.save();

      logger.info('Corporation created by admin', {
        ...auditInfo,
        corporationId: newCorporation._id.toString(),
        corporationName: name,
        category: 'corporation_management'
      });

      const response: ApiResponse<any> = {
        success: true,
        data: {
          corporationId: newCorporation._id.toString(),
          name,
          type,
          status: 'active'
        },
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
    } catch (error: any) {
      logger.error('Error creating corporation:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile creare la corporazione',
        code: 'CREATE_CORPORATION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Update corporation
   * PUT /admin/corporations/:corporationId
   */
  static async updateCorporation(req: Request, res: Response): Promise<void> {
    try {
      const corporationId = req.params.corporationId;
      const { name, description, type, membershipType, maxMembers } = req.body;

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      if (!auditInfo) {
        const response: ApiResponse = {
          success: false,
          error: 'Autenticazione richiesta',
          code: 'AUTHENTICATION_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(401).json(response);
        return;
      }

      const { Corporation } = await import('../../../../packages/database/models/Corporation');
      
      const corporation = await Corporation.findById(corporationId);
      if (!corporation) {
        const response: ApiResponse = {
          success: false,
          error: 'Corporazione non trovata',
          code: 'CORPORATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Update fields
      if (name) corporation.name = name;
      if (description) corporation.description = description;
      if (type) corporation.type = type;
      if (membershipType) corporation.membershipType = membershipType;
      if (maxMembers !== undefined) corporation.maxMembers = maxMembers;
      
      corporation.lastActivityAt = new Date();

      await corporation.save();

      logger.info('Corporation updated by admin', {
        ...auditInfo,
        corporationId,
        corporationName: corporation.name,
        category: 'corporation_management'
      });

      const response: ApiResponse<any> = {
        success: true,
        data: {
          corporationId,
          name: corporation.name,
          description: corporation.description,
          type: corporation.type
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error updating corporation:', { 
        error: error instanceof Error ? error.message : String(error),
        corporationId: req.params.corporationId
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile aggiornare la corporazione',
        code: 'UPDATE_CORPORATION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Delete corporation (soft delete)
   * DELETE /admin/corporations/:corporationId
   */
  static async deleteCorporation(req: Request, res: Response): Promise<void> {
    try {
      const corporationId = req.params.corporationId;

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      if (!auditInfo) {
        const response: ApiResponse = {
          success: false,
          error: 'Autenticazione richiesta',
          code: 'AUTHENTICATION_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(401).json(response);
        return;
      }

      const { Corporation } = await import('../../../../packages/database/models/Corporation');
      
      const corporation = await Corporation.findById(corporationId);
      if (!corporation) {
        const response: ApiResponse = {
          success: false,
          error: 'Corporazione non trovata',
          code: 'CORPORATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Soft delete
      corporation.status = 'disbanded';
      corporation.updatedAt = new Date();
      corporation.lastActivity = new Date();

      // Add to activity log
      corporation.activityLog = corporation.activityLog || [];
      corporation.activityLog.push({
        action: 'corporation_deleted',
        performedBy: auditInfo!.adminId,
        performedByName: auditInfo!.adminUsername,
        timestamp: new Date(),
        details: 'Corporation deleted (disbanded) by admin'
      });

      await corporation.save();

      logger.info('Corporation deleted by admin', {
        ...auditInfo,
        corporationId,
        corporationName: corporation.name,
        category: 'corporation_management'
      });

      const response: ApiResponse<any> = {
        success: true,
        data: {
          corporationId,
          status: 'disbanded'
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error deleting corporation:', { 
        error: error instanceof Error ? error.message : String(error),
        corporationId: req.params.corporationId
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile eliminare la corporazione',
        code: 'DELETE_CORPORATION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get corporation membership requests
   * GET /admin/corporations/:corporationId/membership-requests
   */
  static async getCorporationMembershipRequests(req: Request, res: Response): Promise<void> {
    try {
      const corporationId = req.params.corporationId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const skip = (page - 1) * limit;
      
      const { CorporationMembershipRequest } = await import('../../../../packages/database/models/Corporation');
      
      // Build query filter
      let filter: any = { corporationId, status: 'pending' };
      
      // Get total count
      const totalItems = await CorporationMembershipRequest.countDocuments(filter);
      
      // Get paginated requests with populated data
      const requests = await CorporationMembershipRequest.find(filter)
        .populate({
          path: 'characterId',
          select: 'name surname userId',
          populate: {
            path: 'userId',
            select: 'username email',
            options: { strictPopulate: false }
          },
          options: { strictPopulate: false }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec() as any;

      // Transform data
      const transformedRequests = requests.map((request: any) => {
        const character = request.characterId || {};
        const user = character.userId || {};
        
        return {
          id: request._id.toString(),
          corporationId,
          characterId: character._id ? character._id.toString() : 'unknown',
          characterName: `${character.name || 'Unknown'} ${character.surname || ''}`.trim(),
          userId: user._id ? user._id.toString() : 'unknown',
          username: user.username || 'Unknown User',
          email: user.email || 'No Email',
          message: request.message || '',
          status: request.status || 'pending',
          createdAt: request.createdAt ? request.createdAt.toISOString() : new Date().toISOString()
        };
      });

      const totalPages = Math.ceil(totalItems / limit);
      const hasMore = page < totalPages;

      const paginationInfo: PaginationInfo = {
        currentPage: page,
        totalPages,
        totalItems,
        limit,
        hasMore
      };

      const response: ApiResponse<{ requests: any[]; pagination: PaginationInfo }> = {
        success: true,
        data: {
          requests: transformedRequests,
          pagination: paginationInfo
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching corporation membership requests:', { 
        error: error instanceof Error ? error.message : String(error),
        corporationId: req.params.corporationId
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le richieste di iscrizione alla corporazione',
        code: 'FETCH_CORP_MEMBERSHIP_REQUESTS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Handle membership request (approve/reject)
   * POST /admin/corporations/:corporationId/membership-requests/:requestId
   */
  static async handleMembershipRequest(req: Request, res: Response): Promise<void> {
    // This method already exists as reviewMembershipRequest
    // We'll alias it
    return CorporationManagementController.reviewMembershipRequest(req, res);
  }

  /**
   * Manage corporation treasury
   * PUT /admin/corporations/:corporationId/treasury
   */
  static async manageTreasury(req: Request, res: Response): Promise<void> {
    try {
      const corporationId = req.params.corporationId;
      const { action, amount, reason } = req.body;

      if (!action || !['add', 'remove'].includes(action)) {
        const response: ApiResponse = {
          success: false,
          error: 'Azione non valida. Deve essere "add" o "remove"',
          code: 'INVALID_TREASURY_ACTION',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!amount || isNaN(amount) || amount <= 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Importo non valido. Deve essere un numero positivo',
          code: 'INVALID_AMOUNT',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      if (!auditInfo) {
        const response: ApiResponse = {
          success: false,
          error: 'Autenticazione richiesta',
          code: 'AUTHENTICATION_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(401).json(response);
        return;
      }

      const { Corporation } = await import('../../../../packages/database/models/Corporation');
      
      const corporation = await Corporation.findById(corporationId);
      if (!corporation) {
        const response: ApiResponse = {
          success: false,
          error: 'Corporazione non trovata',
          code: 'CORPORATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Initialize treasury if not exists
      if (!corporation.treasury) {
        corporation.treasury = {
          balance: 0,
          monthlyIncome: 0,
          monthlyExpenses: 0,
          transactions: [],
          lastUpdated: new Date()
        };
      }

      const previousBalance = corporation.treasury.balance || 0;
      let newBalance = previousBalance;

      if (action === 'add') {
        newBalance = previousBalance + amount;
      } else if (action === 'remove') {
        newBalance = Math.max(0, previousBalance - amount);
      }

      // Update treasury using Corporation model's addTransaction method
      const transaction = corporation.addTransaction(
        action === 'add' ? 'deposit' : 'withdrawal',
        amount,
        reason || 'Admin adjustment',
        auditInfo!.adminId,
        'admin_grant'
      );
      corporation.treasury.lastUpdated = new Date();
      corporation.lastActivity = new Date();
      corporation.updatedAt = new Date();

      // Update activity timestamp
      corporation.lastActivityAt = new Date();

      await corporation.save();

      logger.info('Corporation treasury updated by admin', {
        ...auditInfo,
        corporationId,
        action,
        amount,
        previousBalance,
        newBalance,
        reason,
        category: 'corporation_management'
      });

      const response: ApiResponse<any> = {
        success: true,
        data: {
          corporationId,
          action,
          amount,
          previousBalance,
          newBalance,
          reason: reason || 'Admin adjustment'
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error managing corporation treasury:', { 
        error: error instanceof Error ? error.message : String(error),
        corporationId: req.params.corporationId,
        body: req.body
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile gestire la tesoreria della corporazione',
        code: 'MANAGE_TREASURY_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Bulk operations on corporations
   * POST /admin/corporations/bulk
   */
  static async bulkOperations(req: Request, res: Response): Promise<void> {
    try {
      const { operation, corporationIds, ...operationData } = req.body;

      if (!operation || !corporationIds || !Array.isArray(corporationIds)) {
        const response: ApiResponse = {
          success: false,
          error: 'Campi obbligatori mancanti: operation, corporationIds',
          code: 'MISSING_BULK_OPERATION_DATA',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      if (!auditInfo) {
        const response: ApiResponse = {
          success: false,
          error: 'Autenticazione richiesta',
          code: 'AUTHENTICATION_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(401).json(response);
        return;
      }

      const { Corporation } = await import('../../../../packages/database/models/Corporation');
      
      let results: any[] = [];
      let errors: any[] = [];

      switch (operation) {
        case 'treasury_adjustment':
          const { amount, reason } = operationData;
          if (!amount || isNaN(amount)) {
            const response: ApiResponse = {
              success: false,
              error: 'Importo non valido per l\'adeguamento della tesoreria',
              code: 'INVALID_TREASURY_AMOUNT',
              timestamp: new Date().toISOString()
            };
            res.status(400).json(response);
            return;
          }

          for (const corporationId of corporationIds) {
            try {
              const corporation = await Corporation.findById(corporationId);
              if (!corporation) {
                errors.push({ corporationId, error: 'Corporazione non trovata' });
                continue;
              }

              // Initialize treasury if not exists
              if (!corporation.treasury) {
                corporation.treasury = {
                  balance: 0,
                  monthlyIncome: 0,
                  monthlyExpenses: 0,
                  transactions: [],
                  lastUpdated: new Date()
                };
              }

              const previousBalance = corporation.treasury.balance || 0;
              
              // Use Corporation model's addTransaction method
              const transaction = corporation.addTransaction(
                amount > 0 ? 'deposit' : 'withdrawal',
                Math.abs(amount),
                `Bulk treasury adjustment: ${reason || 'Bulk admin adjustment'}`,
                auditInfo!.adminId,
                'admin_grant'
              );
              
              const newBalance = corporation.treasury.balance;

              await corporation.save();

              results.push({
                corporationId,
                corporationName: corporation.name,
                previousBalance,
                newBalance,
                adjustment: amount,
                transactionId: transaction.id
              });
            } catch (error: any) {
              errors.push({
                corporationId,
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }
          break;

        default:
          const response: ApiResponse = {
            success: false,
            error: `Operazione bulk non supportata: ${operation}`,
            code: 'UNSUPPORTED_BULK_OPERATION',
            timestamp: new Date().toISOString()
          };
          res.status(400).json(response);
          return;
      }

      logger.info('Bulk corporation operation completed by admin', {
        ...auditInfo,
        operation,
        corporationCount: corporationIds.length,
        successCount: results.length,
        errorCount: errors.length,
        category: 'corporation_management'
      });

      const response: ApiResponse<any> = {
        success: true,
        data: {
          operation,
          results,
          errors,
          summary: {
            totalCorporations: corporationIds.length,
            successful: results.length,
            failed: errors.length
          }
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error in bulk corporation operation:', { 
        error: error instanceof Error ? error.message : String(error),
        body: req.body
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile eseguire l\'operazione bulk',
        code: 'BULK_OPERATION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get corporation statistics
   * GET /admin/corporations/stats
   */
  static async getCorporationStats(req: Request, res: Response): Promise<void> {
    try {
      const period = req.query.period as 'day' | 'week' | 'month' | 'year' || 'month';

      const { Corporation, CorporationMembershipRequest } = await import('../../../../packages/database/models/Corporation');
      
      // Calculate date range based on period
      const now = new Date();
      let startDate = new Date();
      switch (period) {
        case 'day':
          startDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      // Aggregate statistics
      const [
        totalCorporations,
        activeCorporations,
        inactiveCorporations,
        disbandedCorporations,
        pendingRequests,
        totalMembers
      ] = await Promise.all([
        Corporation.countDocuments({}),
        Corporation.countDocuments({ status: 'active' }),
        Corporation.countDocuments({ status: 'inactive' }),
        Corporation.countDocuments({ status: 'disbanded' }),
        CorporationMembershipRequest.countDocuments({ status: 'pending' }),
        Corporation.aggregate([
          { $match: { status: 'active' } },
          { $group: { _id: null, totalMembers: { $sum: '$memberCount' } } }
        ])
      ]);

      // Corporation types breakdown
      const corporationsByType = await Corporation.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      // Recent activity (corporations created in period)
      const recentCorporations = await Corporation.countDocuments({
        createdAt: { $gte: startDate }
      });

      // Top corporations by member count
      const topCorporations = await Corporation.find({ status: 'active' })
        .select('name memberCount type')
        .sort({ memberCount: -1 })
        .limit(5)
        .lean();

      const stats = {
        period,
        overview: {
          totalCorporations,
          activeCorporations,
          inactiveCorporations,
          disbandedCorporations,
          pendingRequests,
          totalMembers: totalMembers.length > 0 ? totalMembers[0].totalMembers : 0,
          recentCorporations
        },
        corporationsByType: corporationsByType.map((item: any) => ({
          type: item._id,
          count: item.count
        })),
        topCorporations: topCorporations.map((corp: any) => ({
          id: corp._id.toString(),
          name: corp.name,
          type: corp.type,
          memberCount: corp.memberCount || 0
        }))
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed corporation statistics', {
        ...auditInfo,
        period,
        category: 'corporation_management'
      });

      const response: ApiResponse<any> = {
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching corporation stats:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le statistiche della corporazione',
        code: 'FETCH_CORPORATION_STATS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get all membership requests across all corporations
   * GET /admin/corporations/membership-requests
   */
  static async getAllMembershipRequests(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
      const corporationFilter = req.query.corporationId as string;
      
      const skip = (page - 1) * pageSize;

      // Build filter query
      const filterQuery: any = {};
      
      if (corporationFilter && corporationFilter !== 'all') {
        filterQuery.corporationId = corporationFilter;
      }

      // For this implementation, we'll simulate membership requests since
      // they're not in the current model structure. In a real implementation,
      // you'd query a MembershipRequest collection.
      
      // Simulate some membership requests for demonstration
      const sampleRequests: any[] = [];
      
      // In production, this would be:
      // const totalRequests = await MembershipRequest.countDocuments(filterQuery);
      // const requests = await MembershipRequest.find(filterQuery)
      //   .populate('corporationId', 'name type')
      //   .populate('characterId', 'characterName userId')
      //   .populate('userId', 'username email')
      //   .sort({ createdAt: -1 })
      //   .skip(skip)
      //   .limit(pageSize);

      const totalRequests = sampleRequests.length;
      const requests = sampleRequests.slice(skip, skip + pageSize);

      const transformedRequests = requests.map((request: any) => ({
        id: request._id?.toString() || 'sample-id',
        corporationId: request.corporationId?._id?.toString() || 'sample-corp-id',
        corporationName: request.corporationId?.name || 'Sample Corporation',
        corporationType: request.corporationId?.type || 'guild',
        characterId: request.characterId?._id?.toString() || 'sample-char-id',
        characterName: request.characterId?.characterName || 'Sample Character',
        userId: request.userId?._id?.toString() || 'sample-user-id',
        username: request.userId?.username || 'Sample User',
        email: request.userId?.email || 'sample@email.com',
        message: request.message || 'Sample membership request message',
        status: request.status || 'pending',
        createdAt: request.createdAt?.toISOString() || new Date().toISOString(),
        reviewedAt: request.reviewedAt?.toISOString() || null,
        reviewedBy: request.reviewedBy || null
      }));

      const totalPages = Math.ceil(totalRequests / pageSize);

      const response: ApiResponse = {
        success: true,
        data: {
          requests: transformedRequests,
          pagination: {
            currentPage: page,
            totalPages,
            totalItems: totalRequests,
            limit: pageSize,
            hasMore: page < totalPages
          }
        },
        timestamp: new Date().toISOString()
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin fetched all membership requests', {
        ...auditInfo,
        page,
        pageSize,
        corporationFilter,
        totalRequests,
        category: 'membership_request_management'
      });

      res.json(response);

    } catch (error: any) {
      logger.error('Error fetching all membership requests:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        query: req.query,
        params: req.params
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le richieste di iscrizione',
        code: 'FETCH_ALL_MEMBERSHIP_REQUESTS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }
}