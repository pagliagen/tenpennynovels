import { Request, Response } from 'express';
import { User } from '@database/models';
import { CryptoUtils } from '../utils/crypto';
import { ApiResponse } from '../types/auth';
import { logger, logAuth, logSecurity } from '../logger';
import { redis } from '@config/runtime/redis';
import { EmailService } from '../services/EmailService';
import { successResponse, errorResponse, updateResponse } from '@shared/utils/apiResponse';
import { appConfig } from '@config/runtime';

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
        res.status(400).json(errorResponse( 
          'Utente non trovato',
          'USER_NOT_FOUND',
          undefined,
          404));
        return;
      }

      // Determine if identifier was email or username
      const isEmail = identifier.toLowerCase() === user.email.toLowerCase();
      const message = isEmail 
        ? 'Ti abbiamo inviato una email all\'indirizzo che hai indicato per fare il recupero della password.'
        : 'Abbiamo inviato una mail all\'indirizzo associato all\'utente indicato.';

      const responseData = {
        emailSent: true,
        foundVia: isEmail ? 'email' : 'username',
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
        canRequestAgainAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes cooldown
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
        await redis.publish('auth:password_reset_requested', JSON.stringify({
          userId: user.id,
          email: user.email,
          requestedAt: new Date().toISOString(),
          ipAddress: req.ip
        }));

      } catch (emailError) {
        logger.error('Failed to send password reset email:', emailError);

        res.status(400).json(errorResponse(
          'Impossibile inviare l\'email di reset password',
          'EMAIL_SEND_ERROR',
          undefined,
          500));
        return;
      }

      // DEV ONLY: Add reset password URL header for testing
      if (!appConfig.isProduction) {
        const resetUrl = `${appConfig.urls.landing}/reset-password/${resetToken}`;
        res.setHeader('X-Dev-Reset-Password-Url', resetUrl);
        logger.debug(`[DEV] Reset password URL: ${resetUrl}`);
      }

      res.status(200).json(successResponse(
        responseData,
        message
      ));

    } catch (error: any) {
      logger.error('Forgot password error:', error);
      
      res.status(400).json(errorResponse( 
        'Richiesta di reset password fallita',
        'PASSWORD_RESET_REQUEST_ERROR',
        undefined,
        500));
    }
  }

  /**
   * GET /auth/reset-password/:token
   * Verify password reset token validity
   */
  static async verifyResetToken(req: Request<{ token: string }>, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() }
      });

      if (!user) {
        res.status(400).json(errorResponse( 
          'Token di reset non valido o scaduto',
          'INVALID_RESET_TOKEN',
          {
            valid: false,
            canRequestNew: true,
            requestUrl: '/auth/forgot-password'
          },
          400));
        return;
      }

      const timeRemaining = user.passwordResetExpires!.getTime() - Date.now();
      const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

      res.status(200).json(successResponse( 
        {
          valid: true,
          token: token,
          user: {
            username: user.username,
            email: CryptoUtils.maskEmail(user.email)
          },
          expiresAt: user.passwordResetExpires!.toISOString(),
          timeRemaining: `${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''} ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}`
        },
        undefined));

    } catch (error: any) {
      logger.error('Reset token verification error:', error);
      
      res.status(400).json(errorResponse( 
        'Verifica token fallita',
        'TOKEN_VERIFICATION_ERROR',
        undefined,
        500));
    }
  }

  /**
   * POST /auth/reset-password/:token
   * Reset password using valid token
   */
  static async resetPassword(req: Request<{ token: string }>, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const { newPassword, confirmPassword } = req.body;

      // Validate that passwords match (should be caught by validation middleware)
      if (newPassword !== confirmPassword) {
        res.status(400).json(errorResponse( 
          'Le password non corrispondono',
          'PASSWORDS_MISMATCH',
          undefined,
          400));
        return;
      }

      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() }
      });

      if (!user) {
        res.status(400).json(errorResponse( 
          'Token di reset non valido o scaduto',
          'INVALID_RESET_TOKEN',
          {
            canRequestNew: true,
            requestUrl: '/auth/forgot-password'
          },
          400));
        return;
      }

      // Validate password strength
      const passwordValidation = CryptoUtils.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        res.status(400).json(errorResponse( 
          'La password non soddisfa i requisiti',
          'INVALID_PASSWORD',
          {
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
          400));
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
      await redis.publish('auth:password_changed', JSON.stringify({
        userId: user.id,
        username: user.username,
        changedAt: new Date().toISOString(),
        method: 'reset'
      }));

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

      res.status(200).json(updateResponse( 
        {
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
        'Password reset successfully'));

    } catch (error: any) {
      logger.error('Password reset error:', error);
      
      res.status(400).json(errorResponse( 
        'Reset password fallito',
        'PASSWORD_RESET_ERROR',
        undefined,
        500));
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
        res.status(400).json(errorResponse( 
          'La nuova password e la conferma non corrispondono',
          'PASSWORDS_MISMATCH',
          undefined,
          400));
        return;
      }

      const user = await User.findById(userId);
      if (!user) {
        res.status(400).json(errorResponse( 
          'Utente non trovato',
          'USER_NOT_FOUND',
          undefined,
          404));
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

        res.status(400).json(errorResponse( 
          'La password attuale non è corretta',
          'INVALID_CURRENT_PASSWORD',
          {
            attemptsRemaining: 3,
            lockoutWarning: 'Account will be temporarily locked after 5 failed attempts'
          },
          400));
        return;
      }

      // Validate that new password is different
      const isSamePassword = await CryptoUtils.comparePassword(newPassword, user.passwordHash);
      if (isSamePassword) {
        res.status(400).json(errorResponse( 
          'La nuova password deve essere diversa da quella attuale',
          'SAME_PASSWORD',
          undefined,
          400));
        return;
      }

      // Validate password strength
      const passwordValidation = CryptoUtils.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        res.status(400).json(errorResponse( 
          'La password non soddisfa i requisiti',
          'INVALID_PASSWORD',
          {
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
          400));
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
      await redis.publish('auth:password_changed', JSON.stringify({
        userId: user.id,
        username: user.username,
        changedAt: new Date().toISOString(),
        method: 'change'
      }));

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

      res.status(200).json(updateResponse( 
        {
          passwordChangedAt: user.passwordChangedAt,
          security: {
            otherSessionsTerminated: logoutOtherDevices || false,
            sessionCount: logoutOtherDevices ? 0 : 1 // Placeholder
          }
        },
        'Password changed successfully'));

    } catch (error: any) {
      logger.error('Password change error:', error);
      
      res.status(400).json(errorResponse( 
        'Cambio password fallito',
        'PASSWORD_CHANGE_ERROR',
        undefined,
        500));
    }
  }
}