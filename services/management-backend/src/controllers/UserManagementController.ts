import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { 
  ApiResponse, 
  AdminUserProfile, 
  UserBan,
  UserSummary,
  PaginationInfo
} from '../types/management';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import { User } from '../models/User';
import { Character } from '../models/Character';

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
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortOrder = req.query.sortOrder as string || 'desc';

      // Build MongoDB query filters
      const filters: any = {};

      // Search filter (username, email, displayName)
      if (search && search.trim()) {
        filters.$or = [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } }
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

      // Build sort object
      const sortObject: any = {};
      sortObject[sortBy] = sortOrder === 'desc' ? -1 : 1;

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
        { $limit: userIds.length * 3 }, // Max 3 characters per user for preview
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
        id: (user._id as any)?.toString(),
        username: user.username,
        email: user.email,
        displayName: user.displayName || '',
        canAccessAdminPanel: user.canAccessAdminPanel,
        // Granular permission system
        userRoles: user.userRoles || [],
        characterRoles: user.characterRoles || [],
        characterPermissions: user.characterPermissions || [],
        accountStatus: {
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
          isBanned: user.isBanned
        },
        multipleCharactersAllowed: user.multipleCharactersAllowed,
        characters: charactersMap.get((user._id as any)?.toString()) || [],
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
        limit: pageSize,
        hasMore: page < totalPages
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed user list', {
        ...auditInfo,
        filters: { search, status, role, sortBy, sortOrder },
        page,
        pageSize,
        totalUsers
      });

      const response: ApiResponse<{ users: AdminUserProfile[]; pagination: PaginationInfo }> = {
        success: true,
        data: {
          users: transformedUsers,
          pagination
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching users:', { error: error instanceof Error ? error.message : String(error) });
      
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch users',
        code: 'FETCH_USERS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get detailed user profile for admin management
   * GET /admin/users/:userId
   */
  static async getUserProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;

      // TODO: Implement database query
      // Mock data simulating a gestore user with full permissions
      const mockUser: AdminUserProfile = {
        id: userId,
        username: userId === '68977cc5d4c78ce0d9fd0d49' ? 'admin' : 'gestore_user',
        email: userId === '68977cc5d4c78ce0d9fd0d49' ? 'admin@tenpennynovels.com' : 'gestore@tenpennynovels.com',
        displayName: userId === '68977cc5d4c78ce0d9fd0d49' ? 'System Administrator' : 'Site Manager',
        avatar: '/avatars/admin.jpg',
        canAccessAdminPanel: true,
        // Granular permission system
        userRoles: ['gestore'],
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
            socialClass: 'upper',
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

      const response: ApiResponse<AdminUserProfile> = {
        success: true,
        data: mockUser,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching user profile:', { 
        error: error instanceof Error ? error.message : String(error), 
        userId: req.params.userId 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch user profile',
        code: 'FETCH_USER_PROFILE_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Ban or unban a user
   * POST /admin/users/:userId/ban
   */
  static async banUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;
      const banData: UserBan = req.body;

      // Validate ban data
      if (!banData.reason || banData.reason.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Ban reason is required',
          code: 'BAN_REASON_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!banData.duration || !['temporary', 'permanent'].includes(banData.duration)) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid ban duration',
          code: 'INVALID_BAN_DURATION',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (banData.duration === 'temporary' && !banData.bannedUntil) {
        const response: ApiResponse = {
          success: false,
          error: 'Ban end date required for temporary bans',
          code: 'BAN_END_DATE_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // TODO: Implement user ban logic
      // - Update user status in database
      // - Send notification to user if required
      // - Create audit log entry
      // - Publish Redis event for real-time disconnection

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.warn('User banned by admin', {
        ...auditInfo,
        targetUserId: userId,
        banDuration: banData.duration,
        banReason: banData.reason,
        banScope: banData.banScope,
        bannedUntil: banData.bannedUntil,
        category: 'user_management'
      });

      // TODO: Send Redis event to force disconnect user
      // await redisClient.publish('user:banned', {
      //   userId,
      //   bannedBy: req.user?.userId,
      //   reason: banData.reason,
      //   duration: banData.duration,
      //   scope: banData.banScope,
      //   timestamp: new Date().toISOString()
      // });

      const response: ApiResponse<{ userId: string; action: string }> = {
        success: true,
        data: {
          userId,
          action: 'banned'
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error banning user:', { 
        error: error instanceof Error ? error.message : String(error), 
        userId: req.params.userId 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Failed to ban user',
        code: 'BAN_USER_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Update ban details for a user
   * PATCH /admin/users/:userId/ban
   */
  static async updateBan(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;
      const banData = req.body;

      // Validate userId format
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid user ID format. User ID must be a valid MongoDB ObjectId.',
          code: 'INVALID_USER_ID_FORMAT',
          details: {
            providedId: userId,
            expectedFormat: 'MongoDB ObjectId (24 hex characters)'
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Validate required fields
      if (!banData.reason || banData.reason.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Ban reason is required and cannot be empty.',
          code: 'BAN_REASON_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!banData.duration || !['temporary', 'permanent'].includes(banData.duration)) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid ban duration. Must be "temporary" or "permanent".',
          code: 'INVALID_BAN_DURATION',
          details: {
            providedDuration: banData.duration,
            allowedValues: ['temporary', 'permanent']
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (banData.duration === 'temporary' && !banData.bannedUntil) {
        const response: ApiResponse = {
          success: false,
          error: 'Ban end date is required for temporary bans.',
          code: 'BAN_END_DATE_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Validate ban scopes
      if (!banData.banScopes || !Array.isArray(banData.banScopes) || banData.banScopes.length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'At least one ban scope is required.',
          code: 'BAN_SCOPES_REQUIRED',
          details: {
            availableScopes: ['chat_banned', 'game_banned', 'forum_banned', 'documents_banned', 'full_site_banned']
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const validScopes = ['chat_banned', 'game_banned', 'forum_banned', 'documents_banned', 'full_site_banned'];
      const invalidScopes = banData.banScopes.filter((scope: string) => !validScopes.includes(scope));
      if (invalidScopes.length > 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid ban scopes provided.',
          code: 'INVALID_BAN_SCOPES',
          details: {
            invalidScopes,
            validScopes
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Find user in database
      const user = await User.findById(userId);
      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not found with the provided ID.',
          code: 'USER_NOT_FOUND',
          details: {
            searchedUserId: userId
          },
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Build update object
      const updateData: Record<string, any> = {
        'accountStatus.isBanned': true,
        'accountStatus.banReason': banData.reason.trim(),
        'accountStatus.banScopes': banData.banScopes,
        'accountStatus.bannedAt': new Date(),
        'accountStatus.bannedBy': 'Administrator', // TODO: Get actual admin info from token
        'accountStatus.updatedAt': new Date()
      };

      // Add bannedUntil only for temporary bans
      if (banData.duration === 'temporary' && banData.bannedUntil) {
        updateData['accountStatus.bannedUntil'] = new Date(banData.bannedUntil);
      } else if (banData.duration === 'permanent') {
        updateData['accountStatus.bannedUntil'] = null;
      }

      // Update user in database
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
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

      const response: ApiResponse<{ userId: string; action: string; banDetails: any }> = {
        success: true,
        data: {
          userId,
          action: 'ban_updated',
          banDetails: {
            reason: banData.reason,
            duration: banData.duration,
            scopes: banData.banScopes,
            bannedUntil: banData.bannedUntil,
            bannedAt: updateData['accountStatus.bannedAt']
          }
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error updating user ban:', { 
        error: error instanceof Error ? error.message : String(error), 
        userId: req.params.userId,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Failed to update user ban details. Please try again.',
        code: 'UPDATE_BAN_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Unban a user
   * DELETE /admin/users/:userId/ban
   */
  static async unbanUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;
      const { reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Unban reason is required',
          code: 'UNBAN_REASON_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // TODO: Implement user unban logic
      // - Update user status in database
      // - Send notification to user
      // - Create audit log entry
      // - Publish Redis event

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('User unbanned by admin', {
        ...auditInfo,
        targetUserId: userId,
        unbanReason: reason,
        category: 'user_management'
      });

      const response: ApiResponse<{ userId: string; action: string }> = {
        success: true,
        data: {
          userId,
          action: 'unbanned'
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error unbanning user:', { 
        error: error instanceof Error ? error.message : String(error), 
        userId: req.params.userId 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Failed to unban user',
        code: 'UNBAN_USER_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Update user information
   * PATCH /admin/users/:userId
   */
  static async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;
      
      // Validate userId format
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid user ID format. User ID must be a valid MongoDB ObjectId.',
          code: 'INVALID_USER_ID_FORMAT',
          details: {
            providedId: userId,
            expectedFormat: 'MongoDB ObjectId (24 hex characters)'
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'Request body cannot be empty. At least one field must be provided for update.',
          code: 'EMPTY_UPDATE_PAYLOAD',
          details: {
            allowedFields: ['username', 'email', 'displayName', 'canAccessAdminPanel', 'userRoles', 'characterRoles', 'characterPermissions', 'isActive', 'multipleCharactersAllowed'],
            receivedFields: Object.keys(updateData)
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'Validation failed. Please check the provided data.',
          code: 'VALIDATION_ERRORS',
          details: {
            errors: validationErrors,
            providedData: updateData
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
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
          const duplicateField = (existingUser as any).username === username?.trim() ? 'username' : 'email';
          const response: ApiResponse = {
            success: false,
            error: `A user with this ${duplicateField} already exists.`,
            code: 'DUPLICATE_USER_DATA',
            details: {
              duplicateField,
              duplicateValue: duplicateField === 'username' ? username : email,
              existingUserId: (existingUser as any)._id.toString()
            },
            timestamp: new Date().toISOString()
          };
          res.status(409).json(response);
          return;
        }
      }

      // Check if user exists and update
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateFields },
        { 
          new: true, 
          runValidators: true,
          select: '-passwordHash -emailVerificationToken -passwordResetToken'
        }
      ).lean();

      if (!updatedUser) {
        const response: ApiResponse = {
          success: false,
          error: 'User not found. The specified user ID does not exist in the database.',
          code: 'USER_NOT_FOUND',
          details: {
            requestedUserId: userId,
            searchPerformed: true
          },
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Transform to API format
      const userData = updatedUser as any;
      const transformedUser: AdminUserProfile = {
        id: userData._id.toString(),
        username: userData.username,
        email: userData.email,
        displayName: userData.displayName || '',
        canAccessAdminPanel: userData.canAccessAdminPanel,
        // Granular permission system
        userRoles: userData.userRoles || [],
        characterRoles: userData.characterRoles || [],
        characterPermissions: userData.characterPermissions || [],
        accountStatus: {
          isActive: userData.isActive,
          isEmailVerified: userData.isEmailVerified,
          isBanned: userData.isBanned
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

      const response: ApiResponse<AdminUserProfile> = {
        success: true,
        data: transformedUser,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error updating user:', { 
        error: error instanceof Error ? error.message : String(error),
        errorCode: error.code,
        errorName: error.name,
        userId: req.params.userId,
        stack: error.stack 
      });

      // Handle specific MongoDB validation errors
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map((err: any) => ({
          field: err.path,
          message: err.message,
          value: err.value
        }));

        const response: ApiResponse = {
          success: false,
          error: 'Database validation failed. The provided data does not meet the required constraints.',
          code: 'DATABASE_VALIDATION_ERROR',
          details: {
            validationErrors,
            affectedFields: Object.keys(error.errors)
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Handle MongoDB duplicate key errors
      if (error.code === 11000) {
        const duplicateField = error.keyValue ? Object.keys(error.keyValue)[0] : 'unknown';
        const duplicateValue = error.keyValue ? error.keyValue[duplicateField] : 'unknown';

        const response: ApiResponse = {
          success: false,
          error: `A user with this ${duplicateField} already exists. Please choose a different value.`,
          code: 'DUPLICATE_KEY_ERROR',
          details: {
            duplicateField,
            duplicateValue,
            mongoErrorCode: error.code,
            indexName: error.keyPattern ? Object.keys(error.keyPattern)[0] : 'unknown'
          },
          timestamp: new Date().toISOString()
        };
        res.status(409).json(response);
        return;
      }

      // Handle CastError (invalid data types)
      if (error.name === 'CastError') {
        const response: ApiResponse = {
          success: false,
          error: `Invalid data type for field '${error.path}'. Expected ${error.kind} but received ${typeof error.value}.`,
          code: 'INVALID_DATA_TYPE',
          details: {
            field: error.path,
            expectedType: error.kind,
            receivedValue: error.value,
            receivedType: typeof error.value
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Handle database connection errors
      if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
        const response: ApiResponse = {
          success: false,
          error: 'Database connection error. Please try again later.',
          code: 'DATABASE_CONNECTION_ERROR',
          details: {
            errorType: error.name,
            retryable: true
          },
          timestamp: new Date().toISOString()
        };
        res.status(503).json(response);
        return;
      }

      // Handle permission errors (if user tries to update their own admin status inappropriately)
      if (error instanceof Error ? error.message : String(error) && error instanceof Error ? error.message : String(error).includes('permission')) {
        const response: ApiResponse = {
          success: false,
          error: 'Insufficient permissions to perform this operation.',
          code: 'INSUFFICIENT_PERMISSIONS',
          details: {
            operation: 'update_user',
            userId: req.params.userId
          },
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
      }
      
      // Generic server error
      const response: ApiResponse = {
        success: false,
        error: 'An unexpected error occurred while updating the user. Our team has been notified.',
        code: 'INTERNAL_SERVER_ERROR',
        details: {
          errorType: error.name || 'UnknownError',
          operation: 'update_user',
          userId: req.params.userId,
          timestamp: new Date().toISOString(),
          requestId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        },
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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

      const response: ApiResponse<UserSummary> = {
        success: true,
        data: mockSummary,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching user summary:', { error: error instanceof Error ? error.message : String(error) });
      
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch user summary',
        code: 'FETCH_USER_SUMMARY_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'Search query must be at least 2 characters',
          code: 'INVALID_SEARCH_QUERY',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
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

      const response: ApiResponse<any[]> = {
        success: true,
        data: mockResults,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error searching users:', { error: error instanceof Error ? error.message : String(error) });
      
      const response: ApiResponse = {
        success: false,
        error: 'Failed to search users',
        code: 'SEARCH_USERS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }


  /**
   * Update user permissions (userRole and canAccessAdminPanel only)
   * PATCH /admin/users/:userId/permissions 
   * Only GESTORE can modify user permissions
   */
  static async updateUserPermissions(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { userRoles, canAccessAdminPanel } = req.body;
      const adminUserId = (req as any).adminUserId;

      logger.info('Update user permissions request', {
        userId,
        newUserRoles: userRoles,
        newCanAccessAdminPanel: canAccessAdminPanel,
        adminUserId
      });

      // Validate input
      if (userRoles && (!Array.isArray(userRoles) || !userRoles.every((role: any) => ['user', 'gestore'].includes(role)))) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid user roles. Must be array containing "user" and/or "gestore"',
          code: 'INVALID_USER_ROLES',
          details: {
            providedRoles: userRoles,
            allowedRoles: ['user', 'gestore']
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (canAccessAdminPanel !== undefined && typeof canAccessAdminPanel !== 'boolean') {
        const response: ApiResponse = {
          success: false,
          error: 'canAccessAdminPanel must be a boolean value',
          code: 'INVALID_ADMIN_PANEL_ACCESS',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Check if trying to modify self
      if (userId === adminUserId) {
        const response: ApiResponse = {
          success: false,
          error: 'Cannot modify your own permissions',
          code: 'CANNOT_MODIFY_SELF',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
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
        { new: true, select: '-passwordHash -emailVerificationToken -passwordResetToken' }
      );

      if (!updatedUser) {
        const response: ApiResponse = {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      logger.info('User permissions updated', {
        userId,
        changes: updateFields,
        updatedBy: adminUserId
      });

      const response: ApiResponse = {
        success: true,
        data: {
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
        },
        timestamp: new Date().toISOString()
      };

      logger.info('User permissions updated successfully', {
        userId,
        updatedBy: adminUserId,
        changes: response.data.changes
      });

      res.json(response);
    } catch (error: any) {
      logger.error('Error updating user permissions:', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.params.userId,
        adminUserId: (req as any).adminUserId
      });

      const response: ApiResponse = {
        success: false,
        error: 'Failed to update user permissions',
        code: 'UPDATE_USER_PERMISSIONS_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }
}