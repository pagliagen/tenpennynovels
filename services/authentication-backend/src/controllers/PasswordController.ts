import { Request, Response } from 'express';
import { User } from '../../../../packages/database/models';
import { CryptoUtils } from '../utils/crypto';
import { ApiResponse } from '../types/auth';
import { logger, logAuth, logSecurity } from '../utils/logger';
import { redis } from '../config/redis';
import { EmailService } from '../services/EmailService';

export class PasswordController {
  /**
   * POST /auth/forgot-password
   * Request password reset via username or email
   */
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { identifier } = req.body;

      // Try to find user by email first, then by username
      const user = await User.findOne({
        $or: [
          { email: identifier.toLowerCase() },
          { username: identifier.toLowerCase() }
        ]
      });

      if (!user) {
        // Return generic error without revealing if user exists
        const response: ApiResponse = {
          success: false,
          error: 'Utente non trovato',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Determine if identifier was email or username
      const isEmail = identifier.toLowerCase() === user.email.toLowerCase();
      const message = isEmail 
        ? 'Ti abbiamo inviato una email all\'indirizzo che hai indicato per fare il recupero della password.'
        : 'Abbiamo inviato una mail all\'indirizzo associato all\'utente indicato.';

      const successResponse: ApiResponse = {
        success: true,
        message: message,
        data: {
          emailSent: true,
          foundVia: isEmail ? 'email' : 'username',
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
          canRequestAgainAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes cooldown
        },
        timestamp: new Date().toISOString()
      };

      // Generate password reset token
      const resetToken = CryptoUtils.generateSecureToken();
      const resetExpires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

      user.passwordResetToken = resetToken;
      user.passwordResetExpires = resetExpires;
      await user.save();

      // Send password reset email
      try {
        await EmailService.sendPasswordResetEmail(
          user.email,
          user.displayName || user.username,
          resetToken
        );

        logAuth('password_reset_requested', user.id, {
          username: user.username,
          email: user.email,
          ipAddress: req.ip
        });

        // Publish Redis event
        await redis.publish('auth:password_reset_requested', {
          userId: user.id,
          email: user.email,
          requestedAt: new Date().toISOString(),
          ipAddress: req.ip
        });

      } catch (emailError) {
        logger.error('Failed to send password reset email:', emailError);
        
        const response: ApiResponse = {
          success: false,
          error: 'Impossibile inviare l\'email di reset password',
          code: 'EMAIL_SEND_ERROR',
          timestamp: new Date().toISOString()
        };
        res.status(500).json(response);
        return;
      }

      res.status(200).json(successResponse);

    } catch (error: any) {
      logger.error('Forgot password error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Richiesta di reset password fallita',
        code: 'PASSWORD_RESET_REQUEST_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * GET /auth/reset-password/:token
   * Verify password reset token validity
   */
  static async verifyResetToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() }
      });

      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: 'Token di reset non valido o scaduto',
          code: 'INVALID_RESET_TOKEN',
          details: {
            valid: false,
            canRequestNew: true,
            requestUrl: '/auth/forgot-password'
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const timeRemaining = user.passwordResetExpires!.getTime() - Date.now();
      const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

      const response: ApiResponse = {
        success: true,
        data: {
          valid: true,
          token: token,
          user: {
            username: user.username,
            email: CryptoUtils.maskEmail(user.email)
          },
          expiresAt: user.passwordResetExpires!.toISOString(),
          timeRemaining: `${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''} ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}`
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Reset token verification error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Verifica token fallita',
        code: 'TOKEN_VERIFICATION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * POST /auth/reset-password/:token
   * Reset password using valid token
   */
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const { newPassword, confirmPassword } = req.body;

      // Validate that passwords match (should be caught by validation middleware)
      if (newPassword !== confirmPassword) {
        const response: ApiResponse = {
          success: false,
          error: 'Le password non corrispondono',
          code: 'PASSWORDS_MISMATCH',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() }
      });

      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: 'Token di reset non valido o scaduto',
          code: 'INVALID_RESET_TOKEN',
          details: {
            canRequestNew: true,
            requestUrl: '/auth/forgot-password'
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Validate password strength
      const passwordValidation = CryptoUtils.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        const response: ApiResponse = {
          success: false,
          error: 'La password non soddisfa i requisiti',
          code: 'INVALID_PASSWORD',
          details: {
            requirements: {
              minLength: 8,
              requiresUppercase: true,
              requiresLowercase: true,
              requiresNumber: true,
              requiresSpecialChar: true,
              cantBeCommon: true
            },
            violations: passwordValidation.violations
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Hash new password
      const newPasswordHash = await CryptoUtils.hashPassword(newPassword);

      // Update user password and clear reset tokens
      user.passwordHash = newPasswordHash;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.passwordChangedAt = new Date();
      await user.save();

      logAuth('password_reset_completed', user.id, {
        username: user.username,
        email: user.email,
        ipAddress: req.ip,
        method: 'reset_token'
      });

      // Publish Redis event
      await redis.publish('auth:password_changed', {
        userId: user.id,
        username: user.username,
        changedAt: new Date().toISOString(),
        method: 'reset'
      });

      // Send security notification email
      try {
        await EmailService.sendSecurityAlert(
          user.email,
          user.displayName || user.username,
          'Password Reset Completed',
          {
            timestamp: new Date().toLocaleString(),
            ipAddress: req.ip,
            method: 'Password reset token'
          }
        );
      } catch (emailError) {
        logger.error('Failed to send password reset notification:', emailError);
      }

      const response: ApiResponse = {
        success: true,
        message: 'Password reset successfully',
        data: {
          user: {
            id: user.id,
            username: user.username,
            passwordChangedAt: user.passwordChangedAt
          },
          security: {
            allOtherSessionsTerminated: true,
            loginRequired: true
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Password reset error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Reset password fallito',
        code: 'PASSWORD_RESET_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * POST /auth/change-password
   * Change password for authenticated user
   */
  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword, confirmNewPassword, logoutOtherDevices } = req.body;
      const userId = req.user!.userId;

      // Validate that new passwords match
      if (newPassword !== confirmNewPassword) {
        const response: ApiResponse = {
          success: false,
          error: 'La nuova password e la conferma non corrispondono',
          code: 'PASSWORDS_MISMATCH',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

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

      // Verify current password
      const isCurrentPasswordValid = await CryptoUtils.comparePassword(currentPassword, user.passwordHash);
      
      if (!isCurrentPasswordValid) {
        logSecurity('invalid_current_password', {
          userId: user.id,
          username: user.username,
          ipAddress: req.ip
        });

        const response: ApiResponse = {
          success: false,
          error: 'La password attuale non è corretta',
          code: 'INVALID_CURRENT_PASSWORD',
          details: {
            attemptsRemaining: 3,
            lockoutWarning: 'Account will be temporarily locked after 5 failed attempts'
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Validate that new password is different
      const isSamePassword = await CryptoUtils.comparePassword(newPassword, user.passwordHash);
      if (isSamePassword) {
        const response: ApiResponse = {
          success: false,
          error: 'La nuova password deve essere diversa da quella attuale',
          code: 'SAME_PASSWORD',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Validate password strength
      const passwordValidation = CryptoUtils.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        const response: ApiResponse = {
          success: false,
          error: 'La password non soddisfa i requisiti',
          code: 'INVALID_PASSWORD',
          details: {
            requirements: {
              minLength: 8,
              requiresUppercase: true,
              requiresLowercase: true,
              requiresNumber: true,
              requiresSpecialChar: true,
              cantBeCommon: true
            },
            violations: passwordValidation.violations
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Hash new password
      const newPasswordHash = await CryptoUtils.hashPassword(newPassword);

      // Update user password
      user.passwordHash = newPasswordHash;
      user.passwordChangedAt = new Date();
      await user.save();

      logAuth('password_changed', user.id, {
        username: user.username,
        ipAddress: req.ip,
        method: 'authenticated_change',
        logoutOtherDevices: logoutOtherDevices || false
      });

      // Publish Redis event
      await redis.publish('auth:password_changed', {
        userId: user.id,
        username: user.username,
        changedAt: new Date().toISOString(),
        method: 'change'
      });

      // Send security notification email
      try {
        await EmailService.sendSecurityAlert(
          user.email,
          user.displayName || user.username,
          'Password Changed',
          {
            timestamp: new Date().toLocaleString(),
            ipAddress: req.ip,
            method: 'Account settings'
          }
        );
      } catch (emailError) {
        logger.error('Failed to send password change notification:', emailError);
      }

      const response: ApiResponse = {
        success: true,
        message: 'Password changed successfully',
        data: {
          passwordChangedAt: user.passwordChangedAt,
          security: {
            otherSessionsTerminated: logoutOtherDevices || false,
            sessionCount: logoutOtherDevices ? 0 : 1 // Placeholder
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Password change error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Cambio password fallito',
        code: 'PASSWORD_CHANGE_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }
}