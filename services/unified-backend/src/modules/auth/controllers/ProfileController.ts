import { Request, Response } from 'express';
import { User, Character, db } from '@database/models';
import { ApiResponse } from '../types/auth';
import { logger, logAuth } from '../logger';
import { redis } from '@config/runtime/redis';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { AuthMiddleware } from '../middleware/auth';
import { EmailService } from '../services/EmailService';
import { successResponse, errorResponse, updatedResponse, deletedResponse } from '@shared/utils/apiResponse';

export class ProfileController {
  /**
   * GET /auth/profile
   * Get current user profile
   */
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      const user = await User.findById(userId).select('-passwordHash -emailVerificationToken -passwordResetToken -ipAddress');
      
      if (!user) {
        errorResponse(
          res,
          'Utente non trovato',
          'USER_NOT_FOUND',
          undefined,
          404
        );
        return;
      }

      // Get user's characters (exclude deleted)
      const characters = await Character.find({ 
        userId
      }).select('id name status occupation createdAt');

      successResponse(
        res,
        {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            avatar: user.avatar,
            isEmailVerified: user.isEmailVerified,
            canAccessAdminPanel: user.canAccessAdminPanel,
            // Granular permission system
            userRoles: user.userRoles || ['user'],
            characterRoles: user.characterRoles || [],
            characterPermissions: user.characterPermissions || [],
            account: {
              createdAt: user.createdAt,
              lastLoginAt: user.lastLoginAt,
              loginCount: user.loginCount,
              passwordChangedAt: user.passwordChangedAt
            },
            characters: characters.map(char => ({
              id: char.id,
              name: char.name,
              status: char.status,
              occupation: char.occupation,
              createdAt: char.createdAt
            })),
            preferences: {
              emailNotifications: user.preferences.emailNotifications,
              marketingEmails: user.preferences.marketingEmails,
              theme: user.preferences.theme,
              language: user.preferences.language,
              timezone: user.preferences.timezone
            }
          }
        },
        undefined
      );

    } catch (error: any) {
      logger.error('Get profile error:', error);
      
      errorResponse(res,
        'Impossibile recuperare il profilo',
        'PROFILE_ERROR',
        undefined,
        500
      );
    }
  }

  /**
   * PUT /auth/profile
   * Update user profile
   */
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { displayName, preferences } = req.body;

      const user = await User.findById(userId);
      
      if (!user) {
        errorResponse(
          res,
          'Utente non trovato',
          'USER_NOT_FOUND',
          undefined,
          404
        );
        return;
      }

      const changes: any = {};

      // Update display name if provided
      if (displayName !== undefined && displayName !== user.displayName) {
        user.displayName = displayName;
        changes.displayName = { from: user.displayName, to: displayName };
      }

      // Update preferences if provided
      if (preferences) {
        const preferenceChanges: any = {};
        
        if (preferences.emailNotifications !== undefined && preferences.emailNotifications !== user.preferences.emailNotifications) {
          user.preferences.emailNotifications = preferences.emailNotifications;
          preferenceChanges.emailNotifications = { from: user.preferences.emailNotifications, to: preferences.emailNotifications };
        }
        
        if (preferences.marketingEmails !== undefined && preferences.marketingEmails !== user.preferences.marketingEmails) {
          user.preferences.marketingEmails = preferences.marketingEmails;
          preferenceChanges.marketingEmails = { from: user.preferences.marketingEmails, to: preferences.marketingEmails };
        }
        
        if (preferences.theme !== undefined && preferences.theme !== user.preferences.theme) {
          user.preferences.theme = preferences.theme;
          preferenceChanges.theme = { from: user.preferences.theme, to: preferences.theme };
        }
        
        if (preferences.language !== undefined && preferences.language !== user.preferences.language) {
          user.preferences.language = preferences.language;
          preferenceChanges.language = { from: user.preferences.language, to: preferences.language };
        }
        
        if (preferences.timezone !== undefined && preferences.timezone !== user.preferences.timezone) {
          user.preferences.timezone = preferences.timezone;
          preferenceChanges.timezone = { from: user.preferences.timezone, to: preferences.timezone };
        }

        if (Object.keys(preferenceChanges).length > 0) {
          changes.preferences = preferenceChanges;
        }
      }

      // Save changes if any
      if (Object.keys(changes).length > 0) {
        await user.save();

        logAuth('profile_updated', user.id, {
          username: user.username,
          changes,
          ipAddress: req.ip
        });

        // Publish Redis event
        await redis.publish('auth:profile_updated', JSON.stringify({
          userId: user.id,
          changes,
          updatedAt: new Date().toISOString()
        }));
      }

      updatedResponse(res, 
        {
          user: {
            id: user.id,
            displayName: user.displayName,
            preferences: {
              emailNotifications: user.preferences.emailNotifications,
              marketingEmails: user.preferences.marketingEmails,
              theme: user.preferences.theme,
              language: user.preferences.language,
              timezone: user.preferences.timezone
            },
            updatedAt: user.updatedAt
          }
        },
        'Profile updated successfully');

    } catch (error: any) {
      logger.error('Update profile error:', error);
      
      errorResponse(res,
        'Impossibile aggiornare il profilo',
        'PROFILE_UPDATE_ERROR',
        undefined,
        500
      );
    }
  }

  /**
   * GET /auth/profile/export
   * Export all user data in JSON format
   */
  static async exportData(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      // Parallel queries for performance
      const [userResult, charactersResult] = await Promise.all([
        User.findById(userId).select('-passwordHash -emailVerificationToken -passwordResetToken -ipAddress').lean(),
        Character.find({ userId }).lean()
      ]);

      const user = userResult as any;
      const characters = charactersResult as any[];

      if (!user) {
        errorResponse(
          res,
          'Utente non trovato',
          'USER_NOT_FOUND',
          undefined,
          404
        );
        return;
      }

      // Structure export data
      const exportData = {
        exportDate: new Date().toISOString(),
        exportVersion: '1.0',
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          accountCreated: user.createdAt,
          lastLogin: user.lastLoginAt,
          loginCount: user.loginCount,
          preferences: user.preferences,
          userRoles: user.userRoles || ['user'],
          characterRoles: user.characterRoles || [],
          multipleCharactersAllowed: user.multipleCharactersAllowed
        },
        characters: characters.map((char: any) => ({
          id: char._id.toString(),
          name: char.name,
          surname: char.surname,
          occupation: char.occupation,
          status: char.status,
          stats: char.stats,
          skills: char.skills,
          background: char.background,
          createdAt: char.createdAt,
          approvedAt: char.approvedAt
        })),
        metadata: {
          totalCharacters: characters.length,
          exportRequestedBy: user.username,
          exportRequestIp: req.ip
        }
      };

      // Log audit
      logAuth('data_export', userId, {
        username: user.username,
        exportSize: JSON.stringify(exportData).length,
        charactersIncluded: characters.length,
        ipAddress: req.ip
      });

      // ✅ FIX: Usa formato standard invece di raw JSON
      // Set download headers
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="tenpennynovels-data-${userId}-${Date.now()}.json"`);

      // Usa successResponse per formato standard { result, data, timestamp, requestId }
      successResponse(
        res,
        exportData,
        'Dati esportati con successo'
      );

    } catch (error: any) {
      logger.error('Export data error:', error);

      errorResponse(res,
        'Impossibile esportare i dati',
        'EXPORT_ERROR',
        undefined,
        500
      );
    }
  }

  /**
   * POST /auth/profile/request-deletion
   * Request account deletion (sends confirmation email)
   */
  static async requestAccountDeletion(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      const user = await User.findById(userId);
      if (!user) {
        errorResponse(
          res,
          'Utente non trovato',
          'USER_NOT_FOUND',
          undefined,
          404
        );
        return;
      }

      // Check for pending characters
      const pendingChars = await Character.find({
        userId,
        status: 'PENDING_APPROVAL'
      });

      if (pendingChars.length > 0) {
        errorResponse(res,
          'Hai personaggi in attesa di approvazione. Risolvili prima di eliminare l\'account.',
          'PENDING_CHARACTERS',
          undefined,
          409
        );
        return;
      }

      // Generate deletion token
      const deletionToken = crypto.randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Save token to user
      user.accountDeletionToken = deletionToken;
      user.accountDeletionTokenExpires = tokenExpires;
      user.accountDeletionRequestedAt = new Date();
      await user.save();

      // Send confirmation email
      try {
        await EmailService.sendAccountDeletionEmail(
          user.email,
          user.displayName || user.username,
          deletionToken
        );
      } catch (emailError) {
        logger.error('Failed to send account deletion email:', emailError);
        errorResponse(res,
          'Errore nell\'invio dell\'email di conferma',
          'EMAIL_ERROR',
          undefined,
          500
        );
        return;
      }

      // Log audit
      logAuth('account_deletion_requested', userId, {
        username: user.username,
        ipAddress: req.ip,
        tokenExpires: tokenExpires.toISOString()
      });

      // Publish Redis event
      await redis.publish('auth:account_deletion_requested', JSON.stringify({
        userId: user._id.toString(),
        requestedAt: new Date().toISOString()
      }));

      successResponse(
        res,
        undefined,
        'Email di conferma inviata. Controlla la tua casella di posta.'
      );

    } catch (error: any) {
      logger.error('Request account deletion error:', error);

      errorResponse(res,
        'Errore durante la richiesta di cancellazione',
        'REQUEST_DELETION_ERROR',
        undefined,
        500
      );
    }
  }

  /**
   * POST /auth/delete-account/:token
   * Confirm account deletion (via email link)
   */
  static async confirmAccountDeletion(req: Request<{ token: string }>, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      if (!token) {
        errorResponse(res,
          'Token richiesto',
          'MISSING_TOKEN',
          undefined,
          400
        );
        return;
      }

      // Find user by deletion token
      const user = await User.findOne({
        accountDeletionToken: token,
        accountDeletionTokenExpires: { $gt: new Date() }
      });

      if (!user) {
        errorResponse(res,
          'Token non valido o scaduto',
          'INVALID_TOKEN',
          undefined,
          400
        );
        return;
      }

      const userId = user._id.toString();
      const originalEmail = user.email;

      // Start transaction for atomicity
      const session = await db.getConnection().startSession();
      session.startTransaction();

      try {
        // Anonymize user data
        user.accountStatus = 'anonymized';
        user.anonymizedAt = new Date();
        user.anonymizationReason = 'user_request';
        user.username = `deleted_user_${user._id.toString().slice(-8)}`;
        user.email = `deleted_${user._id}@anonymized.tpn`;
        user.displayName = undefined;
        user.avatar = undefined;
        user.passwordHash = 'ANONYMIZED';
        user.isEmailVerified = false;
        user.emailVerificationToken = undefined;
        user.passwordResetToken = undefined;
        user.accountDeletionToken = undefined;
        user.accountDeletionTokenExpires = undefined;
        user.ipAddress = undefined;
        user.referralCode = undefined;
        user.preferences = {
          emailNotifications: false,
          marketingEmails: false,
          theme: 'victorian_dark',
          language: 'it',
          timezone: 'Europe/London'
        };

        await user.save({ session });

        await Character.updateMany(
          { userId: user._id, status: { $ne: 'DELETED' } },
          { $set: { status: 'DELETED' } },
          { session }
        );

        await session.commitTransaction();

        // Log audit (after transaction)
        logAuth('account_deleted', userId, {
          username: `deleted_user_${user._id.toString().slice(-8)}`,
          reason: 'user_request',
          originalEmail: originalEmail
        });

        // Publish Redis event
        await redis.publish('auth:account_deleted', JSON.stringify({
          userId: userId,
          anonymizedAt: user.anonymizedAt!.toISOString()
        }));

        successResponse(
          res,
          undefined,
          'Account eliminato con successo'
        );

      } catch (txError) {
        await session.abortTransaction();
        throw txError;
      } finally {
        session.endSession();
      }

    } catch (error: any) {
      logger.error('Confirm account deletion error:', error);

      errorResponse(res,
        'Errore durante l\'eliminazione dell\'account',
        'DELETE_ERROR',
        undefined,
        500
      );
    }
  }
}