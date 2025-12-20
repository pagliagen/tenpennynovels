import { Request, Response } from 'express';
import { User, Character } from '../../../../packages/database/models';
import { CryptoUtils } from '../utils/crypto';
import { ApiResponse } from '../../../../packages/shared/types';
import { logger, logAuth } from '../utils/logger';
import { redis } from '../config/redis';
import { EmailService } from '../services/EmailService';

export class RegistrationController {
  /**
   * POST /auth/register
   * Register new user with email verification
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { username, email, password, displayName, agreeToTerms, subscribeNewsletter, referralCode } = req.body;

      // Check if username already exists
      const existingUsername = await User.findOne({ username: username.toLowerCase() });
      if (existingUsername) {
        const suggestions = [
          `${username}_alt`,
          `${username}_${new Date().getFullYear()}`,
          `${username}_player`
        ];

        const response: ApiResponse = {
          success: false,
          error: 'Username già esistente',
          code: 'USERNAME_TAKEN',
          details: { suggestions },
          timestamp: new Date().toISOString()
        };
        res.status(409).json(response);
        return;
      }

      // Check if email already exists
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        const response: ApiResponse = {
          success: false,
          error: 'Indirizzo email già registrato',
          code: 'EMAIL_TAKEN',
          details: {
            canRecover: true,
            message: 'If you forgot your password, you can reset it using the password recovery option.'
          },
          timestamp: new Date().toISOString()
        };
        res.status(409).json(response);
        return;
      }

      // Hash password
      const passwordHash = await CryptoUtils.hashPassword(password);

      // Generate email verification token
      const emailVerificationToken = CryptoUtils.generateSecureToken();
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create user
      const user = new User({
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        displayName: displayName || username,
        passwordHash,
        isEmailVerified: false,
        emailVerificationToken,
        emailVerificationExpires,
        registrationSource: 'web',
        ipAddress: req.ip,
        preferences: {
          emailNotifications: true,
          marketingEmails: subscribeNewsletter || false,
          theme: 'victorian_dark',
          language: 'en',
          timezone: 'Europe/London'
        }
      });

      await user.save();

      // Create default character for the user
      let defaultCharacter;
      try {
        defaultCharacter = new Character({
          userId: user.id,
          name: user.username,
          status: 'DRAFT',
          gameplayRoles: ['personaggio'],
          skills: {},
          isActive: false,
          submittedAt: new Date()
        });

        await defaultCharacter.save();
        
        logger.info(`Default character created for user ${user.username}: ${defaultCharacter.id}`);
      } catch (characterError) {
        logger.error(`Failed to create default character for user ${user.username}:`, characterError);
        // Continue with registration even if character creation fails
      }

      // Send verification email
      try {
        await EmailService.sendVerificationEmail(user.email, user.displayName || user.username, emailVerificationToken);
        
        logAuth('user_registered', user.id, {
          username: user.username,
          email: user.email,
          ipAddress: req.ip,
          hasReferral: !!referralCode
        });

        // Publish Redis event
        await redis.publish('auth:user_registered', {
          userId: user.id,
          username: user.username,
          email: user.email,
          registeredAt: new Date().toISOString(),
          ipAddress: req.ip,
          referralCode
        });

      } catch (emailError) {
        logger.error('Failed to send verification email:', emailError);
        // Continue with registration even if email fails
      }

      const response: ApiResponse = {
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            isEmailVerified: user.isEmailVerified,
            createdAt: user.createdAt
          },
          verification: {
            emailSent: true,
            expiresAt: emailVerificationExpires.toISOString(),
            canResendAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes cooldown
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);

    } catch (error: any) {
      logger.error('Registration error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Registrazione fallita',
        code: 'REGISTRATION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * POST /auth/register/check-availability
   * Check username/email availability
   */
  static async checkAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { username, email } = req.body;
      const availability: any = {};

      if (username) {
        const existingUsername = await User.findOne({ username: username.toLowerCase() });
        availability.username = {
          available: !existingUsername,
          suggestions: existingUsername ? [
            `${username}_alt`,
            `${username}_${new Date().getFullYear()}`,
            `${username}_player`
          ] : undefined
        };
      }

      if (email) {
        const existingEmail = await User.findOne({ email: email.toLowerCase() });
        availability.email = {
          available: !existingEmail
        };
      }

      const response: ApiResponse = {
        success: true,
        data: { availability },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Availability check error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Controllo disponibilità fallito',
        code: 'AVAILABILITY_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * GET /auth/verify-email/:token
   * Verify email address using token
   */
  static async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: new Date() }
      });

      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: 'Token di verifica non valido o scaduto',
          code: 'INVALID_VERIFICATION_TOKEN',
          details: {
            canResend: true,
            resendUrl: '/auth/resend-verification'
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Mark email as verified
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      logAuth('email_verified', user.id, {
        username: user.username,
        email: user.email,
        ipAddress: req.ip
      });

      // Publish Redis event
      await redis.publish('auth:email_verified', {
        userId: user.id,
        username: user.username,
        email: user.email,
        verifiedAt: new Date().toISOString()
      });

      const response: ApiResponse = {
        success: true,
        message: 'Email verified successfully. You can now log in.',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            isEmailVerified: user.isEmailVerified,
            verifiedAt: new Date().toISOString()
          },
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Email verification error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Verifica email fallita',
        code: 'VERIFICATION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * POST /auth/resend-verification
   * Resend email verification
   */
  static async resendVerification(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        // Don't reveal if email exists or not for security
        const response: ApiResponse = {
          success: true,
          message: 'If the email address exists and is not verified, a verification email has been sent.',
          data: {
            emailSent: true,
            canResendAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          },
          timestamp: new Date().toISOString()
        };
        res.status(200).json(response);
        return;
      }

      if (user.isEmailVerified) {
        const response: ApiResponse = {
          success: false,
          error: 'Email già verificata',
          code: 'EMAIL_ALREADY_VERIFIED',
          details: {
            canLogin: true,
            loginUrl: '/login'
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Generate new verification token
      const emailVerificationToken = CryptoUtils.generateSecureToken();
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      user.emailVerificationToken = emailVerificationToken;
      user.emailVerificationExpires = emailVerificationExpires;
      await user.save();

      // Send verification email
      try {
        await EmailService.sendVerificationEmail(user.email, user.displayName || user.username, emailVerificationToken);
      } catch (emailError) {
        logger.error('Failed to resend verification email:', emailError);
        
        const response: ApiResponse = {
          success: false,
          error: 'Impossibile inviare l\'email di verifica',
          code: 'EMAIL_SEND_ERROR',
          timestamp: new Date().toISOString()
        };
        res.status(500).json(response);
        return;
      }

      logAuth('verification_email_resent', user.id, {
        username: user.username,
        email: user.email,
        ipAddress: req.ip
      });

      const response: ApiResponse = {
        success: true,
        message: 'Verification email sent successfully',
        data: {
          emailSent: true,
          canResendAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes cooldown
          expiresAt: emailVerificationExpires.toISOString()
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Resend verification error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile rinviare l\'email di verifica',
        code: 'RESEND_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }
}