import { Request, Response } from 'express';
import { User, Character } from '../../../../packages/database/models';
import { ApiResponse } from '../types/auth';
import { logger, logAuth } from '../utils/logger';
import { redis } from '../config/redis';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { AuthMiddleware } from '../middleware/auth';
import { EmailService } from '../services/EmailService';

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
        const response: ApiResponse = {
          success: false,
          error: 'Utente non trovato',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Get user's characters (exclude deleted)
      const characters = await Character.find({ 
        userId,
        status: { $ne: 'DELETED' }
      }).select('id name status occupation createdAt');

      const response: ApiResponse = {
        success: true,
        data: {
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
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Get profile error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare il profilo',
        code: 'PROFILE_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'Utente non trovato',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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
        await redis.publish('auth:profile_updated', {
          userId: user.id,
          changes,
          updatedAt: new Date().toISOString()
        });
      }

      const response: ApiResponse = {
        success: true,
        message: 'Profile updated successfully',
        data: {
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
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Update profile error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile aggiornare il profilo',
        code: 'PROFILE_UPDATE_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'Utente non trovato',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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

      // Set download headers
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="tenpennynovels-data-${userId}-${Date.now()}.json"`);
      res.status(200).json(exportData);

    } catch (error: any) {
      logger.error('Export data error:', error);

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile esportare i dati',
        code: 'EXPORT_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'Utente non trovato',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Check for pending characters
      const pendingChars = await Character.find({
        userId,
        status: 'PENDING_APPROVAL'
      });

      if (pendingChars.length > 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Hai personaggi in attesa di approvazione. Risolvili prima di eliminare l\'account.',
          code: 'PENDING_CHARACTERS',
          timestamp: new Date().toISOString()
        };
        res.status(409).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'Errore nell\'invio dell\'email di conferma',
          code: 'EMAIL_ERROR',
          timestamp: new Date().toISOString()
        };
        res.status(500).json(response);
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

      const response: ApiResponse = {
        success: true,
        message: 'Email di conferma inviata. Controlla la tua casella di posta.',
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Request account deletion error:', error);

      const response: ApiResponse = {
        success: false,
        error: 'Errore durante la richiesta di cancellazione',
        code: 'REQUEST_DELETION_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * POST /auth/delete-account/:token
   * Confirm account deletion (via email link)
   */
  static async confirmAccountDeletion(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      if (!token) {
        const response: ApiResponse = {
          success: false,
          error: 'Token richiesto',
          code: 'MISSING_TOKEN',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Find user by deletion token
      const user = await User.findOne({
        accountDeletionToken: token,
        accountDeletionTokenExpires: { $gt: new Date() }
      });

      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: 'Token non valido o scaduto',
          code: 'INVALID_TOKEN',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const userId = user._id.toString();
      const originalEmail = user.email;

      // Start transaction for atomicity
      const session = await mongoose.startSession();
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

        // Soft delete all characters
        await Character.updateMany(
          { userId: user._id, status: { $ne: 'DELETED' } },
          { $set: { status: 'DELETED', deletedAt: new Date() } },
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

        const response: ApiResponse = {
          success: true,
          message: 'Account eliminato con successo',
          timestamp: new Date().toISOString()
        };
        res.status(200).json(response);

      } catch (txError) {
        await session.abortTransaction();
        throw txError;
      } finally {
        session.endSession();
      }

    } catch (error: any) {
      logger.error('Confirm account deletion error:', error);

      const response: ApiResponse = {
        success: false,
        error: 'Errore durante l\'eliminazione dell\'account',
        code: 'DELETE_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }
}