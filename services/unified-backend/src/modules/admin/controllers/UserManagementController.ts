import { Request, Response } from 'express';
import {
  ApiResponse,
  AdminUserProfile,
  UserBan,
  UserSummary,
  PaginationInfo
} from '../types/management';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import { User, Character, db } from '@database/models';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '../utils/apiResponse';

import { escapeRegex } from '@shared/utils/validation';

// Access mongoose from the centralized connection
const mongoose = db.getMongoose();

export class UserManagementController {
  /**
   * Get list of users with admin filtering and search
   * GET /admin/users
   */
  static async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 25;
      const search = req.query.search as string;
      const status = req.query.status as string;
      const role = req.query.role as string;
      const canAccessAdminPanel = req.query.canAccessAdminPanel as string;
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortOrder = req.query.sortOrder as string || 'desc';

      // Build MongoDB query filters
      const filters: any = {};

      // Search filter (username, email, displayName)
      if (search && search.trim()) {
        const escapedSearch = escapeRegex(search);
        filters.$or = [
          { username: { $regex: escapedSearch, $options: 'i' } },
          { email: { $regex: escapedSearch, $options: 'i' } },
          { displayName: { $regex: escapedSearch, $options: 'i' } }
        ];
      }

      // Status filter
      if (status) {
        if (status === 'active') {
          filters.isActive = true;
          filters.isBanned = false;
        } else if (status === 'banned') {
          filters.isBanned = true;
        } else if (status === 'inactive') {
          filters.isActive = false;
        }
      }

      // Role filter - support both legacy and new system
      if (role && role !== 'all') {
        if (role === 'no_role') {
          filters.$and = [
            { $or: [
              { userRoles: { $size: 0 } },
              { userRoles: { $exists: false } }
            ]},
            { $or: [
              { characterRoles: { $size: 0 } },
              { characterRoles: { $exists: false } }
            ]}
          ];
        } else if (role === 'gestore') {
          filters.userRoles = { $in: [role] };
        } else {
          filters.characterRoles = { $in: [role] };
        }
      }

      // Admin access filter
      if (canAccessAdminPanel !== undefined && canAccessAdminPanel !== '') {
        filters.canAccessAdminPanel = canAccessAdminPanel === 'true';
      }

      // Map nested sort fields to flat database fields
      const sortFieldMap: Record<string, string> = {
        'accountStatus.isActive': 'isActive',
        'accountStatus.isBanned': 'isBanned',
        'accountStatus.bannedAt': 'bannedAt',
        'accountStatus.isEmailVerified': 'isEmailVerified',
        'registrationInfo.registeredAt': 'createdAt',
        'activity.lastLoginAt': 'lastLoginAt'
      };

      const mappedSortBy = sortFieldMap[sortBy] || sortBy;

      // Build sort object
      const sortObject: any = {};
      sortObject[mappedSortBy] = sortOrder === 'desc' ? -1 : 1;

      // Count total documents
      const totalUsers = await User.countDocuments(filters);

      // Execute query with pagination
      const users = await User.find(filters)
        .select('-passwordHash -emailVerificationToken -passwordResetToken')
        .sort(sortObject)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean();

      // Get character counts for each user
      const userIds = users.map(user => user._id);

      // Skip character aggregations if no users found (avoid MongoDB limit error)
      if (userIds.length === 0) {
        const transformedUsers: AdminUserProfile[] = [];
        const emptyPagination = {
          currentPage: page,
          totalPages: 0,
          totalItems: 0,
          pageSize,
          hasNextPage: false,
          hasPreviousPage: false
        };
        res.json({ success: true, list: transformedUsers, pagination: emptyPagination });
        return;
      }

      const characterCounts = await Character.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } }
      ]);

      const characterCountMap = new Map();
      characterCounts.forEach(({ _id, count }) => {
        characterCountMap.set(_id.toString(), count);
      });

      // Get characters for each user (limited to recent ones) with occupation lookup
      const charactersData = await Character.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $sort: { createdAt: -1 } },
        { $limit: userIds.length * 10 }, // Preview limit: up to 10 characters per user in list view
        {
          $lookup: {
            from: 'occupations',
            localField: 'occupation',
            foreignField: '_id',
            as: 'occupationData'
          }
        },
        {
          $project: {
            userId: 1,
            name: 1,
            status: 1,
            occupation: { $ifNull: [{ $arrayElemAt: ['$occupationData.name', 0] }, 'Unknown'] },
            createdAt: 1,
            lastActive: 1
          }
        }
      ]);

      const charactersMap = new Map();
      charactersData.forEach(char => {
        const userId = char.userId.toString();
        if (!charactersMap.has(userId)) {
          charactersMap.set(userId, []);
        }
        charactersMap.get(userId).push({
          id: char._id.toString(),
          name: char.name,
          status: char.status,
          occupation: char.occupation || 'Unknown', // Now comes from the lookup
          createdAt: char.createdAt?.toISOString(),
          lastActive: char.lastActive?.toISOString()
        });
      });

      // Transform to API format
      const transformedUsers: AdminUserProfile[] = users.map(user => ({
        _id: user._id?.toString(),
        username: user.username,
        email: user.email,
        displayName: user.displayName || '',
        canAccessAdminPanel: user.canAccessAdminPanel,
        accountStatus: {
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
          isBanned: user.isBanned,
          banReason: user.banReason,
          bannedAt: user.bannedAt?.toISOString(),
          bannedBy: user.bannedBy?.toString(),
          bannedUntil: user.bannedUntil?.toISOString(),
          bannedByName: user.bannedByName?.toString(),
        },
        multipleCharactersAllowed: user.multipleCharactersAllowed,
        characters: charactersMap.get(user._id?.toString()) || [],
        activity: {
          lastLoginAt: user.lastLoginAt?.toISOString(),
          loginCount: user.loginCount || 0,
          messagesSent: 0, // TODO: Implement message counting
          documentsCreated: 0, // TODO: Implement document counting
          moderationActions: 0 // TODO: Implement moderation action counting
        },
        registrationInfo: {
          registeredAt: user.createdAt?.toISOString(),
          registrationSource: user.registrationSource || 'web',
          ipAddress: user.ipAddress || '',
          referrer: 'organic' // TODO: Implement referrer tracking
        }
      }));

      const totalPages = Math.ceil(totalUsers / pageSize);
      const pagination: PaginationInfo = {
        currentPage: page,
        totalPages,
        totalItems: totalUsers,
        pageSize,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed user list', {
        ...auditInfo,
        filters: { search, status, role, sortBy, sortOrder },
        currentPage: page,
        pageSize,
        totalUsers
      });

      res.json(listResponse(
        transformedUsers,
        pagination,
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error fetching users:', { error: error instanceof Error ? error.message : String(error) });
      logger.error(error);
      
      res.status(500).json(errorResponse(
        'Failed to fetch users',
        'FETCH_USERS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get detailed user profile for admin management
   * GET /admin/users/:userId
   */
  static async getUserProfile(req: Request<{ userId: string }>, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;

      // TODO: Implement database query
      // Mock data simulating a gestore user with full permissions
      const mockUser: AdminUserProfile = {
        _id: userId,
        username: userId === '68977cc5d4c78ce0d9fd0d49' ? 'admin' : 'gestore_user',
        email: userId === '68977cc5d4c78ce0d9fd0d49' ? 'admin@tenpennynovels.com' : 'gestore@tenpennynovels.com',
        displayName: userId === '68977cc5d4c78ce0d9fd0d49' ? 'System Administrator' : 'Site Manager',
        avatar: '/avatars/admin.jpg',
        canAccessAdminPanel: true,
        // Granular permission system
        userRoles: ['user'],
        characterRoles: ['amministratore'],
        characterPermissions: [
          'system.maintenance_mode',
          'users.delete',
          'locations.delete'
        ],
        accountStatus: {
          isActive: true,
          isEmailVerified: true,
          isBanned: false
        },
        multipleCharactersAllowed: true,
        characters: [
          {
            id: 'char_admin_1',
            name: 'Lord Victorian Administrator',
            status: 'APPROVED',
            occupation: 'Government Official',
            socialClass: 'affluent',
            createdAt: '2024-01-01T10:00:00Z',
            lastActive: '2025-01-15T14:30:00Z'
          }
        ],
        activity: {
          lastLoginAt: '2025-01-15T14:30:00Z',
          loginCount: 234,
          messagesSent: 567,
          documentsCreated: 45,
          moderationActions: 89
        },
        registrationInfo: {
          registeredAt: '2024-01-01T10:00:00Z',
          registrationSource: 'admin_setup',
          ipAddress: '127.0.0.1',
          referrer: 'direct'
        }
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed user profile', {
        ...auditInfo,
        targetUserId: userId,
        targetUsername: mockUser.username
      });

      res.json(successResponse(
        mockUser,
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error fetching user profile:', { 
        error: error instanceof Error ? error.message : String(error), 
        userId: req.params.userId 
      });
      
      res.status(500).json(errorResponse(
        'Failed to fetch user profile',
        'FETCH_USER_PROFILE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Ban or unban a user
   * POST /admin/users/:userId/ban
   */
  static async banUser(req: Request<{ userId: string }>, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;
      const banData: UserBan = req.body;

      // Validate ban data
      if (!banData.reason || banData.reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Ban reason is required',
          'BAN_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!banData.duration || !['temporary', 'permanent'].includes(banData.duration)) {
        res.status(400).json(errorResponse(
          'Invalid ban duration',
          'INVALID_BAN_DURATION',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (banData.duration === 'temporary' && !banData.bannedUntil) {
        res.status(400).json(errorResponse(
          'Ban end date required for temporary bans',
          'BAN_END_DATE_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Import User model
      const { User } = await import('@database/models/User');

      // Get audit info for bannedBy field (includes character name from cookie)
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      if (!auditInfo) {
        res.status(401).json(errorResponse(
          'Autenticazione richiesta',
          'UNAUTHORIZED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      // Prepare update data
      const updateData: any = {
        isBanned: true,
        banReason: banData.reason.trim(),
        bannedAt: new Date(),
        bannedBy: auditInfo.adminId,
        bannedByName: auditInfo.adminCharacterName // Character name from JWT cookie
      };

      // Add bannedUntil for temporary bans
      if (banData.duration === 'temporary' && banData.bannedUntil) {
        updateData.bannedUntil = new Date(banData.bannedUntil);
      } else {
        // Permanent ban - no expiration
        updateData.$unset = { bannedUntil: '' };
      }

      // Update user in database
      const user = await User.findByIdAndUpdate(
        userId,
        updateData,
        { returnDocument: 'after' }
      );

      if (!user) {
        res.status(404).json(errorResponse(
          'Utente non trovato',
          'USER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      logger.warn('User banned by admin', {
        ...auditInfo,
        targetUserId: userId,
        banDuration: banData.duration,
        banReason: banData.reason,
        bannedUntil: banData.bannedUntil,
        category: 'user_management'
      });

      res.json(createResponse(
        { userId, action: 'banned' },
        'User banned successfully',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error banning user:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorDetails: error,
        userId: req.params.userId
      });

      res.status(500).json(errorResponse(
        'Failed to ban user',
        'BAN_USER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update ban details for a user
   * PATCH /admin/users/:userId/ban
   */
  static async updateBan(req: Request<{ userId: string }>, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;
      const banData = req.body;

      // Validate userId format
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json(errorResponse(
          'Invalid user ID format. User ID must be a valid MongoDB ObjectId.',
          'INVALID_USER_ID_FORMAT',
          {
            providedId: userId,
            expectedFormat: 'MongoDB ObjectId (24 hex characters)'
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate required fields
      if (!banData.reason || banData.reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Ban reason is required and cannot be empty.',
          'BAN_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!banData.duration || !['temporary', 'permanent'].includes(banData.duration)) {
        res.status(400).json(errorResponse(
          'Invalid ban duration. Must be "temporary" or "permanent".',
          'INVALID_BAN_DURATION',
          {
            providedDuration: banData.duration,
            allowedValues: ['temporary', 'permanent']
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      if (banData.duration === 'temporary' && !banData.bannedUntil) {
        res.status(400).json(errorResponse(
          'Ban end date is required for temporary bans.',
          'BAN_END_DATE_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate ban scopes
      if (!banData.banScopes || !Array.isArray(banData.banScopes) || banData.banScopes.length === 0) {
        res.status(400).json(errorResponse(
          'At least one ban scope is required.',
          'BAN_SCOPES_REQUIRED',
          {
            availableScopes: ['chat_banned', 'game_banned', 'forum_banned', 'documents_banned', 'full_site_banned']
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      const validScopes = ['chat_banned', 'game_banned', 'forum_banned', 'documents_banned', 'full_site_banned'];
      const invalidScopes = banData.banScopes.filter((scope: string) => !validScopes.includes(scope));
      if (invalidScopes.length > 0) {
        res.status(400).json(errorResponse(
          'Invalid ban scopes provided.',
          'INVALID_BAN_SCOPES',
          {
            invalidScopes,
            validScopes
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      // Find user in database
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json(errorResponse(
          'Utente non trovato con l\'ID fornito.',
          'USER_NOT_FOUND',
          {
            searchedUserId: userId
          },
          404,
          getRequestId(req)
        ));
        return;
      }

      // Build update object (note: fields are flat in schema, not nested under accountStatus)
      const updateData: Record<string, any> = {
        isBanned: true,
        banReason: banData.reason.trim(),
        banScope: banData.banScopes[0], // Take first scope for now (schema only supports single scope)
        bannedAt: new Date(),
        bannedBy: 'Administrator', // TODO: Get actual admin info from token
        updatedAt: new Date()
      };

      // Add bannedUntil only for temporary bans
      if (banData.duration === 'temporary' && banData.bannedUntil) {
        updateData.bannedUntil = new Date(banData.bannedUntil);
      } else if (banData.duration === 'permanent') {
        updateData.bannedUntil = null;
      }

      // Update user in database
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { returnDocument: 'after', runValidators: true }
      );

      if (!updatedUser) {
        throw new Error('Failed to update user ban status');
      }

      // Log audit action
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.warn('User ban updated by admin', {
        ...auditInfo,
        targetUserId: userId,
        targetUsername: user.username,
        banDuration: banData.duration,
        banReason: banData.reason,
        banScopes: banData.banScopes,
        bannedUntil: banData.bannedUntil,
        category: 'user_management'
      });

      // TODO: Send Redis event to force disconnect user and update sessions
      // await redisClient.publish('user:ban_updated', {
      //   userId,
      //   bannedBy: auditInfo.adminUserId,
      //   reason: banData.reason,
      //   duration: banData.duration,
      //   scopes: banData.banScopes,
      //   bannedUntil: banData.bannedUntil,
      //   timestamp: new Date().toISOString()
      // });

      // Return the updated user object (frontend expects User, not metadata)
      res.json(updateResponse(
        updatedUser.toObject(),
        'User ban updated successfully',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error updating user ban:', { 
        error: error instanceof Error ? error.message : String(error), 
        userId: req.params.userId,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      res.status(500).json(errorResponse(
        'Failed to update user ban details. Please try again.',
        'UPDATE_BAN_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Unban a user
   * DELETE /admin/users/:userId/ban
   */
  static async unbanUser(req: Request<{ userId: string }>, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;
      const { reason } = req.body || {};

      // Import User model
      const { User } = await import('@database/models/User');

      // Update user in database - remove ban fields
      const user = await User.findByIdAndUpdate(
        userId,
        {
          isBanned: false,
          $unset: { banReason: '', bannedAt: '', bannedUntil: '', bannedBy: '', bannedByName: '' }
        },
        { returnDocument: 'after' }
      );

      if (!user) {
        res.status(404).json(errorResponse(
          'Utente non trovato',
          'USER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('User unbanned by admin', {
        ...auditInfo,
        targetUserId: userId,
        unbanReason: reason,
        category: 'user_management'
      });

      res.json(updateResponse(
        { userId, action: 'unbanned' },
        'User unbanned successfully',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error unbanning user:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorDetails: error,
        userId: req.params.userId
      });

      res.status(500).json(errorResponse(
        'Failed to unban user',
        'UNBAN_USER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Bulk ban multiple users
   * POST /admin/users/bulk-ban
   */
  static async bulkBanUsers(req: Request, res: Response): Promise<void> {
    try {
      const { userIds, reason, duration, bannedUntil } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json(errorResponse(
          'userIds array is required',
          'INVALID_INPUT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate ban data
      if (!reason || reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Ban reason is required',
          'BAN_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!duration || !['temporary', 'permanent'].includes(duration)) {
        res.status(400).json(errorResponse(
          'Invalid ban duration',
          'INVALID_BAN_DURATION',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (duration === 'temporary' && !bannedUntil) {
        res.status(400).json(errorResponse(
          'Ban end date required for temporary bans',
          'BAN_END_DATE_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const { User } = await import('@database/models/User');
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      if (!auditInfo) {
        res.status(401).json(errorResponse(
          'Autenticazione richiesta',
          'UNAUTHORIZED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      // Ban all users
      const results = await Promise.allSettled(
        userIds.map(async (userId: string) => {
          if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error(`Invalid userId: ${userId}`);
          }

          const updateData: any = {
            isBanned: true,
            banReason: reason,
            bannedAt: new Date(),
            bannedBy: auditInfo.adminId,
            bannedByName: auditInfo.adminCharacterName,
            bannedUntil: duration === 'temporary' && bannedUntil ? new Date(bannedUntil) : null
          };

          if (duration === 'temporary' && bannedUntil) {
            updateData.bannedUntil = new Date(bannedUntil);
          }

          const user = await User.findByIdAndUpdate(
            userId,
            updateData,
            { returnDocument: 'after' }
          );

          if (!user) {
            throw new Error(`User not found: ${userId}`);
          }

          return user;
        })
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failedCount = results.filter(r => r.status === 'rejected').length;

      logger.info('Bulk ban users completed', {
        ...auditInfo,
        totalUsers: userIds.length,
        successful: successCount,
        failed: failedCount,
        reason
      });

      res.json(successResponse(
        {
          success: successCount,
          failed: failedCount,
          results: results.map((r, i) => ({
            userId: userIds[i],
            success: r.status === 'fulfilled',
            error: r.status === 'rejected' ? r.reason : undefined
          }))
        },
        'Bulk ban completed',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error in bulk ban users:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json(errorResponse(
        'Failed to bulk ban users',
        'BULK_BAN_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Bulk unban multiple users
   * POST /admin/users/bulk-unban
   */
  static async bulkUnbanUsers(req: Request, res: Response): Promise<void> {
    try {
      const { userIds, reason } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json(errorResponse(
          'userIds array is required',
          'INVALID_INPUT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const { User } = await import('@database/models/User');
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);

      // Unban all users
      const results = await Promise.allSettled(
        userIds.map(async (userId: string) => {
          if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error(`Invalid userId: ${userId}`);
          }

          const user = await User.findByIdAndUpdate(
            userId,
            {
              isBanned: false,
              $unset: { banReason: '', bannedAt: '', bannedBy: '', bannedByName: '', bannedUntil: '' }
            },
            { returnDocument: 'after' }
          );

          if (!user) {
            throw new Error(`User not found: ${userId}`);
          }

          return user;
        })
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failedCount = results.filter(r => r.status === 'rejected').length;

      logger.info('Bulk unban users completed', {
        ...auditInfo,
        totalUsers: userIds.length,
        successful: successCount,
        failed: failedCount
      });

      res.json(successResponse(
        {
          success: successCount,
          failed: failedCount,
          results: results.map((r, i) => ({
            userId: userIds[i],
            success: r.status === 'fulfilled',
            error: r.status === 'rejected' ? r.reason : undefined
          }))
        },
        'Bulk unban completed',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error in bulk unban users:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json(errorResponse(
        'Failed to bulk unban users',
        'BULK_UNBAN_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update user information
   * PATCH /admin/users/:userId
   */
  static async updateUser(req: Request<{ userId: string }>, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;
      
      // Validate userId format
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json(errorResponse(
          'Invalid user ID format. User ID must be a valid MongoDB ObjectId.',
          'INVALID_USER_ID_FORMAT',
          {
            providedId: userId,
            expectedFormat: 'MongoDB ObjectId (24 hex characters)'
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      const updateData = req.body;
      const { 
        username, 
        email, 
        displayName, 
        canAccessAdminPanel, 
        userRoles, 
        characterRoles, 
        characterPermissions,
        isActive, 
        multipleCharactersAllowed 
      } = updateData;

      // Validate payload structure
      if (!updateData || Object.keys(updateData).length === 0) {
        res.status(400).json(errorResponse(
          'Request body cannot be empty. At least one field must be provided for update.',
          'EMPTY_UPDATE_PAYLOAD',
          {
            allowedFields: ['username', 'email', 'displayName', 'canAccessAdminPanel', 'userRoles', 'characterRoles', 'characterPermissions', 'isActive', 'multipleCharactersAllowed'],
            receivedFields: Object.keys(updateData)
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      // Field-specific validation
      const validationErrors: string[] = [];

      // Username validation
      if (username !== undefined) {
        if (typeof username !== 'string') {
          validationErrors.push('Username must be a string');
        } else if (username.trim().length < 3) {
          validationErrors.push('Username must be at least 3 characters long');
        } else if (username.trim().length > 20) {
          validationErrors.push('Username cannot exceed 20 characters');
        } else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
          validationErrors.push('Username can only contain letters, numbers, and underscores');
        }
      }

      // Email validation
      if (email !== undefined) {
        if (typeof email !== 'string') {
          validationErrors.push('Email must be a string');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          validationErrors.push('Email must be a valid email address');
        }
      }

      // DisplayName validation
      if (displayName !== undefined && displayName !== null) {
        if (typeof displayName !== 'string') {
          validationErrors.push('Display name must be a string');
        } else if (displayName.trim().length > 50) {
          validationErrors.push('Display name cannot exceed 50 characters');
        }
      }

      // canAccessAdminPanel validation
      if (canAccessAdminPanel !== undefined) {
        if (typeof canAccessAdminPanel !== 'boolean') {
          validationErrors.push('canAccessAdminPanel must be a boolean value (true or false)');
        }
      }

      // Granular system validations
      if (userRoles !== undefined) {
        if (!Array.isArray(userRoles)) {
          validationErrors.push('userRoles must be an array');
        } else {
          const validUserRoles = ['user', 'gestore'];
          const invalidUserRoles = userRoles.filter(role => !validUserRoles.includes(role));
          if (invalidUserRoles.length > 0) {
            validationErrors.push(`Invalid user roles: ${invalidUserRoles.join(', ')}. Valid roles are: ${validUserRoles.join(', ')}`);
          }
        }
      }

      if (characterRoles !== undefined) {
        if (!Array.isArray(characterRoles)) {
          validationErrors.push('characterRoles must be an array');
        } else {
          const validCharacterRoles = ['personaggio', 'master', 'moderatore', 'amministratore'];
          const invalidCharacterRoles = characterRoles.filter(role => !validCharacterRoles.includes(role));
          if (invalidCharacterRoles.length > 0) {
            validationErrors.push(`Invalid character roles: ${invalidCharacterRoles.join(', ')}. Valid roles are: ${validCharacterRoles.join(', ')}`);
          }
        }
      }

      if (characterPermissions !== undefined) {
        if (!Array.isArray(characterPermissions)) {
          validationErrors.push('characterPermissions must be an array');
        } else {
          const invalidPermissions = characterPermissions.filter(perm => 
            typeof perm !== 'string' || !perm.includes('.')
          );
          if (invalidPermissions.length > 0) {
            validationErrors.push('All characterPermissions must be strings in format "section.action"');
          }
        }
      }

      // isActive validation
      if (isActive !== undefined) {
        if (typeof isActive !== 'boolean') {
          validationErrors.push('isActive must be a boolean value (true or false)');
        }
      }

      // multipleCharactersAllowed validation
      if (multipleCharactersAllowed !== undefined) {
        if (typeof multipleCharactersAllowed !== 'boolean') {
          validationErrors.push('multipleCharactersAllowed must be a boolean value (true or false)');
        }
      }

      // Return validation errors if any
      if (validationErrors.length > 0) {
        res.status(400).json(errorResponse(
          'Validation failed. Please check the provided data.',
          'VALIDATION_ERRORS',
          {
            errors: validationErrors,
            providedData: updateData
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      // Build update object with proper field mapping
      const updateFields: any = {};

      if (username !== undefined) {
        updateFields.username = username.trim();
      }
      if (email !== undefined) {
        updateFields.email = email.trim().toLowerCase();
      }
      if (displayName !== undefined) {
        updateFields.displayName = displayName ? displayName.trim() : displayName;
      }
      if (canAccessAdminPanel !== undefined) {
        updateFields.canAccessAdminPanel = canAccessAdminPanel;
      }
      // Granular permission system
      if (userRoles !== undefined) {
        updateFields.userRoles = [...new Set(userRoles)]; // Remove duplicates
      }
      if (characterRoles !== undefined) {
        updateFields.characterRoles = [...new Set(characterRoles)]; // Remove duplicates
      }
      if (characterPermissions !== undefined) {
        updateFields.characterPermissions = [...new Set(characterPermissions)]; // Remove duplicates
      }
      if (isActive !== undefined) {
        updateFields.isActive = isActive;
      }
      if (multipleCharactersAllowed !== undefined) {
        updateFields.multipleCharactersAllowed = multipleCharactersAllowed;
      }

      // Check if username or email already exist (if being updated)
      if (username || email) {
        const existingUserQuery: any = { _id: { $ne: userId } };
        const duplicateChecks: any[] = [];
        
        if (username) {
          duplicateChecks.push({ username: username.trim() });
        }
        if (email) {
          duplicateChecks.push({ email: email.trim().toLowerCase() });
        }
        
        existingUserQuery.$or = duplicateChecks;

        const existingUser = await User.findOne(existingUserQuery).lean();
        if (existingUser) {
          const duplicateField = existingUser.username === username?.trim() ? 'username' : 'email';
          res.status(409).json(errorResponse(
            `A user with this ${duplicateField} already exists.`,
            'DUPLICATE_USER_DATA',
            {
              duplicateField,
              duplicateValue: duplicateField === 'username' ? username : email,
              existingUserId: existingUser._id.toString()
            },
            409,
            getRequestId(req)
          ));
          return;
        }
      }

      // Check if user exists and update
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateFields },
        { 
          returnDocument: 'after', 
          runValidators: true,
          select: '-passwordHash -emailVerificationToken -passwordResetToken'
        }
      ).lean();

      if (!updatedUser) {
        res.status(404).json(errorResponse(
          'Utente non trovato. L\'ID utente specificato non esiste nel database.',
          'USER_NOT_FOUND',
          {
            requestedUserId: userId,
            searchPerformed: true
          },
          404,
          getRequestId(req)
        ));
        return;
      }

      // Transform to API format
      const userData = updatedUser;
      const transformedUser: AdminUserProfile = {
        _id: userData._id.toString(),
        username: userData.username,
        email: userData.email,
        displayName: userData.displayName || '',
        canAccessAdminPanel: userData.canAccessAdminPanel,
        accountStatus: {
          isActive: userData.isActive,
          isEmailVerified: userData.isEmailVerified,
          isBanned: userData.isBanned,
          banReason: userData.banReason,
          bannedAt: userData.bannedAt?.toISOString(),
          bannedBy: userData.bannedBy?.toString()
        },
        multipleCharactersAllowed: userData.multipleCharactersAllowed,
        characters: [], // Not needed for update response
        activity: {
          lastLoginAt: userData.lastLoginAt?.toISOString(),
          loginCount: userData.loginCount || 0,
          messagesSent: 0,
          documentsCreated: 0,
          moderationActions: 0
        },
        registrationInfo: {
          registeredAt: userData.createdAt?.toISOString(),
          registrationSource: userData.registrationSource || 'web',
          ipAddress: userData.ipAddress || '',
          referrer: 'organic'
        }
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('User updated by admin', {
        ...auditInfo,
        targetUserId: userId,
        targetUsername: userData.username,
        updatedFields: Object.keys(updateFields),
        category: 'user_management'
      });

      res.json(updateResponse(
        transformedUser,
        'User updated successfully',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string; code?: number; stack?: string; errors?: Record<string, { path: string; message: string; value: unknown }>; keyValue?: Record<string, unknown>; keyPattern?: Record<string, unknown>; path?: string; kind?: string; value?: unknown };
      logger.error('Error updating user:', { 
        error: err.message ?? String(error),
        errorCode: err.code,
        errorName: err.name,
        userId: req.params.userId,
        stack: err.stack 
      });

      if (err.name === 'ValidationError' && err.errors) {
        const validationErrors = Object.values(err.errors).map((e) => ({
          field: e.path,
          message: e.message,
          value: e.value
        }));

        res.status(400).json(errorResponse(
          'Database validation failed. The provided data does not meet the required constraints.',
          'DATABASE_VALIDATION_ERROR',
          {
            validationErrors,
            affectedFields: Object.keys(err.errors)
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      if (err.code === 11000) {
        const duplicateField = err.keyValue ? Object.keys(err.keyValue)[0] : 'unknown';
        const duplicateValue = err.keyValue ? err.keyValue[duplicateField] : 'unknown';

        res.status(409).json(errorResponse(
          `A user with this ${duplicateField} already exists. Please choose a different value.`,
          'DUPLICATE_KEY_ERROR',
          {
            duplicateField,
            duplicateValue,
            mongoErrorCode: err.code,
            indexName: err.keyPattern ? Object.keys(err.keyPattern)[0] : 'unknown'
          },
          409,
          getRequestId(req)
        ));
        return;
      }

      if (err.name === 'CastError') {
        res.status(400).json(errorResponse(
          `Invalid data type for field '${err.path}'. Expected ${err.kind} but received ${typeof err.value}.`,
          'INVALID_DATA_TYPE',
          {
            field: err.path,
            expectedType: err.kind,
            receivedValue: err.value,
            receivedType: typeof err.value
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      if (err.name === 'MongoNetworkError' || err.name === 'MongoTimeoutError') {
        res.status(503).json(errorResponse(
          'Database connection error. Please try again later.',
          'DATABASE_CONNECTION_ERROR',
          {
            errorType: err.name,
            retryable: true
          },
          503,
          getRequestId(req)
        ));
        return;
      }

      // Handle permission errors (if user tries to update their own admin status inappropriately)
      if (err.message?.includes('permission')) {
        res.status(403).json(errorResponse(
          'Permessi insufficienti per eseguire questa operazione.',
          'INSUFFICIENT_PERMISSIONS',
          {
            operation: 'update_user',
            userId: req.params.userId
          },
          403,
          getRequestId(req)
        ));
        return;
      }
      
      // Generic server error
      res.status(500).json(errorResponse(
        'An unexpected error occurred while updating the user. Our team has been notified.',
        'INTERNAL_SERVER_ERROR',
        {
          errorType: (error as { name?: string }).name || 'UnknownError',
          operation: 'update_user',
          userId: req.params.userId
        },
        500,
        getRequestId(req)
      ));
    }
  }

  static async getUserSummary(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement database queries for user statistics
      const mockSummary: UserSummary = {
        totalUsers: 1250,
        activeUsers: 890,
        adminUsers: 12,
        byUserRole: {
          'gestore': 1
        },
        byCharacterRole: {
          'amministratore': 2,
          'master': 3,
          'moderatore': 4,
          'personaggio': 890
        }
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed user summary', auditInfo);

      res.json(successResponse(
        mockSummary,
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error fetching user summary:', { error: error instanceof Error ? error.message : String(error) });
      
      res.status(500).json(errorResponse(
        'Failed to fetch user summary',
        'FETCH_USER_SUMMARY_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Search users by username or email
   * GET /admin/users/search
   */
  static async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!query || query.trim().length < 2) {
        res.status(400).json(errorResponse(
          'Search query must be at least 2 characters',
          'INVALID_SEARCH_QUERY',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // TODO: Implement user search
      const mockResults = [
        {
          id: '1',
          username: 'player1',
          email: 'player1@example.com',
          isActive: true,
          isBanned: false,
          characterCount: 1
        }
      ];

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin searched users', {
        ...auditInfo,
        searchQuery: query,
        resultsCount: mockResults.length
      });

      res.json(successResponse(
        mockResults,
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error searching users:', { error: error instanceof Error ? error.message : String(error) });
      
      res.status(500).json(errorResponse(
        'Failed to search users',
        'SEARCH_USERS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }


  /**
   * Update user permissions (userRole and canAccessAdminPanel only)
   * PATCH /admin/users/:userId/permissions 
   * Only GESTORE can modify user permissions
   */
  static async updateUserPermissions(req: Request<{ userId: string }>, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { userRoles, canAccessAdminPanel } = req.body;
      const adminUserId = req.user?.userId;

      logger.info('Update user permissions request', {
        userId,
        newUserRoles: userRoles,
        newCanAccessAdminPanel: canAccessAdminPanel,
        adminUserId
      });

      // Validate input
      if (userRoles && (!Array.isArray(userRoles) || !userRoles.every((role: any) => ['user'].includes(role)))) {
        res.status(400).json(errorResponse(
          'Invalid user roles. Must be array containing "user"',
          'INVALID_USER_ROLES',
          {
            providedRoles: userRoles,
            allowedRoles: ['user', 'gestore']
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      if (canAccessAdminPanel !== undefined && typeof canAccessAdminPanel !== 'boolean') {
        res.status(400).json(errorResponse(
          'canAccessAdminPanel must be a boolean value',
          'INVALID_ADMIN_PANEL_ACCESS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Check if trying to modify self
      if (userId === adminUserId) {
        res.status(400).json(errorResponse(
          'Cannot modify your own permissions',
          'CANNOT_MODIFY_SELF',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Update user permissions in database
      const updateFields: any = {};
      if (userRoles !== undefined) {
        updateFields.userRoles = userRoles;
      }
      if (canAccessAdminPanel !== undefined) {
        updateFields.canAccessAdminPanel = canAccessAdminPanel;
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateFields },
        { returnDocument: 'after', select: '-passwordHash -emailVerificationToken -passwordResetToken' }
      );

      if (!updatedUser) {
        res.status(404).json(errorResponse(
          'Utente non trovato',
          'USER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      logger.info('User permissions updated', {
        userId,
        changes: updateFields,
        updatedBy: adminUserId
      });

      const updateResult = {
        user: {
          id: updatedUser._id.toString(),
          username: updatedUser.username,
          email: updatedUser.email,
          displayName: updatedUser.displayName,
          userRoles: updatedUser.userRoles,
          canAccessAdminPanel: updatedUser.canAccessAdminPanel,
          updatedAt: updatedUser.updatedAt.toISOString()
        },
        changes: {
          userRoles: userRoles ? { to: userRoles } : null,
          canAccessAdminPanel: canAccessAdminPanel !== undefined ? { from: false, to: canAccessAdminPanel } : null
        }
      };

      logger.info('User permissions updated successfully', {
        userId,
        updatedBy: adminUserId,
        changes: updateResult.changes
      });

      res.json(updateResponse(
        updateResult,
        'User permissions updated successfully',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error updating user permissions:', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.params.userId,
        adminUserId: req.user?.userId
      });

      res.status(500).json(errorResponse(
        'Failed to update user permissions',
        'UPDATE_USER_PERMISSIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Bulk activate users
   * POST /admin/users/bulk-activate
   */
  static async bulkActivateUsers(req: Request, res: Response): Promise<void> {
    try {
      const { userIds } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json(errorResponse(
          'userIds array is required',
          'INVALID_INPUT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const { User } = await import('@database/models/User');
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);

      // Activate all users
      const results = await Promise.allSettled(
        userIds.map(async (userId: string) => {
          if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error(`Invalid userId: ${userId}`);
          }

          const user = await User.findByIdAndUpdate(
            userId,
            { isActive: true },
            { returnDocument: 'after' }
          );

          if (!user) {
            throw new Error(`User not found: ${userId}`);
          }

          return user;
        })
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failedCount = results.filter(r => r.status === 'rejected').length;

      logger.info('Bulk activate users completed', {
        ...auditInfo,
        totalUsers: userIds.length,
        successful: successCount,
        failed: failedCount
      });

      res.json(successResponse(
        {
          success: successCount,
          failed: failedCount,
          results: results.map((result, index) => ({
            userId: userIds[index],
            success: result.status === 'fulfilled',
            error: result.status === 'rejected' ? result.reason?.message || String(result.reason) : undefined
          }))
        },
        `Bulk activate completed: ${successCount} successful, ${failedCount} failed`,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error in bulk activate users:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorDetails: error
      });

      res.status(500).json(errorResponse(
        'Failed to bulk activate users',
        'BULK_ACTIVATE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Bulk deactivate users
   * POST /admin/users/bulk-deactivate
   */
  static async bulkDeactivateUsers(req: Request, res: Response): Promise<void> {
    try {
      const { userIds } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json(errorResponse(
          'userIds array is required',
          'INVALID_INPUT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const { User } = await import('@database/models/User');
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);

      // Deactivate all users
      const results = await Promise.allSettled(
        userIds.map(async (userId: string) => {
          if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error(`Invalid userId: ${userId}`);
          }

          const user = await User.findByIdAndUpdate(
            userId,
            { isActive: false },
            { returnDocument: 'after' }
          );

          if (!user) {
            throw new Error(`User not found: ${userId}`);
          }

          return user;
        })
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failedCount = results.filter(r => r.status === 'rejected').length;

      logger.info('Bulk deactivate users completed', {
        ...auditInfo,
        totalUsers: userIds.length,
        successful: successCount,
        failed: failedCount
      });

      res.json(successResponse(
        {
          success: successCount,
          failed: failedCount,
          results: results.map((result, index) => ({
            userId: userIds[index],
            success: result.status === 'fulfilled',
            error: result.status === 'rejected' ? result.reason?.message || String(result.reason) : undefined
          }))
        },
        `Bulk deactivate completed: ${successCount} successful, ${failedCount} failed`,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error in bulk deactivate users:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorDetails: error
      });

      res.status(500).json(errorResponse(
        'Failed to bulk deactivate users',
        'BULK_DEACTIVATE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /admin/users/:userId/assign-png
   * Create new PNG character for user
   */
  static async assignPNG(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { name, surname, avatarUrl, description } = req.body;

      // Validate required fields
      if (!name || name.trim().length < 2) {
        res.status(400).json(errorResponse(
          'Nome richiesto (minimo 2 caratteri)',
          'NAME_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate user exists
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json(errorResponse(
          'Utente non trovato',
          'USER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Find user's PG principale for referent
      const pgPrincipale = await Character.findOne({
        userId,
        characterType: 'pg_principale',
        isDeleted: { $ne: true }
      });

      if (!pgPrincipale) {
        res.status(400).json(errorResponse(
          'L\'utente deve avere un PG principale per creare PNG',
          'NO_PG_PRINCIPALE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Check name availability
      const nameExists = await Character.findOne({ name: name.trim(), isDeleted: { $ne: true } });
      if (nameExists) {
        res.status(400).json(errorResponse(
          'Nome personaggio già esistente',
          'NAME_TAKEN',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Create PNG with minimal schema
      const png = new Character({
        userId,
        characterType: 'png',
        referentCharacterId: pgPrincipale._id,
        name: name.trim(),
        surname: surname?.trim() || '',
        avatar: avatarUrl || '',
        publicDescription: description || '',
        playerStatus: 'approved', // PNG auto-approved
        gameplayRoles: ['player'], // Basic permissions
        stats: { // Minimal stats (not used for PNG)
          strength: 50,
          constitution: 50,
          size: 50,
          dexterity: 50,
          charm: 50,
          intelligence: 50,
          power: 50,
          education: 50
        },
        derived: {
          ideaRoll: 50,
          luckRoll: 50,
          knowledge: 50,
          hitPoints: 10,
          sanityPoints: 50,
          magicPoints: 10,
          movementRate: 8,
          damageBonus: '0',
          build: 0
        },
        skills: {}, // Empty skills for PNG
        isActive: false,
        isBot: false
      });

      await png.save();

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('PNG assigned to user', {
        ...auditInfo,
        userId,
        pngId: png._id,
        pngName: png.name,
        referentId: pgPrincipale._id,
        referentName: pgPrincipale.name,
        category: 'character_management'
      });

      res.json(createResponse(
        {
          character: {
            _id: png._id.toString(),
            name: png.name,
            surname: png.surname,
            characterType: png.characterType,
            referentCharacterId: png.referentCharacterId?.toString(),
            referentName: pgPrincipale.name
          }
        },
        'PNG creato con successo',
        getRequestId(req)
      ));

    } catch (error: unknown) {
      logger.error('Assign PNG error:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // Check if it's a Mongoose validation error
      const errorMessage = error instanceof Error ? error.message : 'Impossibile creare PNG';
      const isValidationError = errorMessage.includes('validation failed');

      res.status(isValidationError ? 400 : 500).json(errorResponse(
        isValidationError ? `Errore di validazione: ${errorMessage}` : 'Impossibile creare PNG',
        isValidationError ? 'VALIDATION_ERROR' : 'ASSIGN_PNG_ERROR',
        undefined,
        isValidationError ? 400 : 500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /admin/users/:userId/assign-master
   * Create new Master character for user (max 1 per user)
   */
  static async assignMaster(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { name, surname, avatarUrl } = req.body;

      // Validate required fields
      if (!name || name.trim().length < 2) {
        res.status(400).json(errorResponse(
          'Nome richiesto (minimo 2 caratteri)',
          'NAME_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate user exists
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json(errorResponse(
          'Utente non trovato',
          'USER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check max 1 Master per user
      const existingMaster = await Character.findOne({
        userId,
        characterType: 'pg_master',
        isDeleted: { $ne: true }
      });

      if (existingMaster) {
        res.status(400).json(errorResponse(
          'L\'utente ha già un personaggio Master',
          'MASTER_EXISTS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Check name availability
      const nameExists = await Character.findOne({ name: name.trim(), isDeleted: { $ne: true } });
      if (nameExists) {
        res.status(400).json(errorResponse(
          'Nome personaggio già esistente',
          'NAME_TAKEN',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Create Master with simplified schema + elevated permissions
      const master = new Character({
        userId,
        characterType: 'pg_master',
        name: name.trim(),
        surname: surname?.trim() || '',
        avatar: avatarUrl || '',
        playerStatus: 'approved', // Master auto-approved
        gameplayRoles: ['master'], // Master gameplay permissions
        stats: { // Minimal stats (not used for Master)
          strength: 50,
          constitution: 50,
          size: 50,
          dexterity: 50,
          charm: 50,
          intelligence: 50,
          power: 50,
          education: 50
        },
        derived: {
          ideaRoll: 50,
          luckRoll: 50,
          knowledge: 50,
          hitPoints: 10,
          sanityPoints: 50,
          magicPoints: 10,
          movementRate: 8,
          damageBonus: '0',
          build: 0
        },
        skills: {}, // Empty skills for Master
        isActive: false,
        isBot: false
      });

      await master.save();

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Master assigned to user', {
        ...auditInfo,
        userId,
        masterId: master._id,
        masterName: master.name,
        category: 'character_management'
      });

      res.json(createResponse(
        {
          character: {
            _id: master._id.toString(),
            name: master.name,
            surname: master.surname,
            characterType: master.characterType,
            gameplayRoles: master.gameplayRoles
          }
        },
        'Master creato con successo',
        getRequestId(req)
      ));

    } catch (error: unknown) {
      logger.error('Assign Master error:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // Check if it's a Mongoose validation error
      const errorMessage = error instanceof Error ? error.message : 'Impossibile creare Master';
      const isValidationError = errorMessage.includes('validation failed');

      res.status(isValidationError ? 400 : 500).json(errorResponse(
        isValidationError ? `Errore di validazione: ${errorMessage}` : 'Impossibile creare Master',
        isValidationError ? 'VALIDATION_ERROR' : 'ASSIGN_MASTER_ERROR',
        undefined,
        isValidationError ? 400 : 500,
        getRequestId(req)
      ));
    }
  }
}
