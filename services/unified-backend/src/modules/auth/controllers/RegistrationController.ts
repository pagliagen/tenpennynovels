import { Request, Response } from 'express';
import { User, Character } from '@database/models';
import { CryptoUtils } from '../utils/crypto';
import { ApiResponse } from '../types/auth';
import { logger, logAuth } from '../utils/logger';
import { redis } from '@config/runtime/redis';
import { EmailService } from '../services/EmailService';
import { errorResponse, successResponse, createdResponse } from '@shared/utils/apiResponse';

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

        errorResponse(res, 
          'Username già esistente',
          'USERNAME_TAKEN',
          { suggestions },
          409);
        return;
      }

      // Check if email already exists
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        errorResponse(res, 
          'Indirizzo email già registrato',
          'EMAIL_TAKEN',
          {
            canRecover: true,
            message: 'If you forgot your password, you can reset it using the password recovery option.'
          },
          409);
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
        await redis.publish('auth:user_registered', JSON.stringify({
          userId: user.id,
          username: user.username,
          email: user.email,
          registeredAt: new Date().toISOString(),
          ipAddress: req.ip,
          referralCode
        }));

      } catch (emailError) {
        logger.error('Failed to send verification email:', emailError);
        // Continue with registration even if email fails
      }

      // DEV ONLY: Add verification URL header for testing
      if (process.env.NODE_ENV !== 'production') {
        const verificationUrl = `${process.env.BASE_URL || 'http://localhost:4000'}/?token=${emailVerificationToken}`;
        res.setHeader('X-Dev-Verification-Url', verificationUrl);
        logger.debug(`[DEV] Verification URL: ${verificationUrl}`);
      }

      createdResponse(res, 
        {
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
        'Registrazione completata con successo. Controlla la tua email per verificare il tuo account.');

    } catch (error: any) {
      logger.error('Registration error:', error);
      
      errorResponse(res, 
        'Registrazione fallita',
        'REGISTRATION_ERROR',
        undefined,
        500);
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

      successResponse(res,
        { availability },
        undefined);

    } catch (error: any) {
      logger.error('Availability check error:', error);

      errorResponse(res,
        'Controllo disponibilità fallito',
        'AVAILABILITY_ERROR',
        undefined,
        500);
    }
  }

  /**
   * GET /auth/check-username?username=...
   * Check username availability
   */
  static async checkUsername(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.query;

      if (!username || typeof username !== 'string') {
        errorResponse(res,
          'Username richiesto',
          'VALIDATION_ERROR',
          undefined,
          400);
        return;
      }

      const existingUsername = await User.findOne({ username: username.toLowerCase() });

      successResponse(res,
        {
          available: !existingUsername,
          suggestions: existingUsername ? [
            `${username}_alt`,
            `${username}_${new Date().getFullYear()}`,
            `${username}_player`
          ] : undefined
        },
        undefined);

    } catch (error: any) {
      logger.error('Username check error:', error);

      errorResponse(res,
        'Controllo username fallito',
        'USERNAME_CHECK_ERROR',
        undefined,
        500);
    }
  }

  /**
   * GET /auth/check-email?email=...
   * Check email availability
   */
  static async checkEmail(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.query;

      if (!email || typeof email !== 'string') {
        errorResponse(res,
          'Email richiesta',
          'VALIDATION_ERROR',
          undefined,
          400);
        return;
      }

      const existingEmail = await User.findOne({ email: email.toLowerCase() });

      successResponse(res,
        {
          available: !existingEmail
        },
        undefined);

    } catch (error: any) {
      logger.error('Email check error:', error);

      errorResponse(res,
        'Controllo email fallito',
        'EMAIL_CHECK_ERROR',
        undefined,
        500);
    }
  }

  /**
   * GET /auth/verify-email/:token
   * Verify email address using token
   */
  static async verifyEmail(req: Request<{ token: string }>, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: new Date() }
      });

      if (!user) {
        errorResponse(res, 
          'Token di verifica non valido o scaduto',
          'INVALID_VERIFICATION_TOKEN',
          {
            canResend: true,
            resendUrl: '/auth/resend-verification'
          },
          400);
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
      await redis.publish('auth:email_verified', JSON.stringify({
        userId: user.id,
        username: user.username,
        email: user.email,
        verifiedAt: new Date().toISOString()
      }));

      successResponse(res, 
        {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            isEmailVerified: user.isEmailVerified,
            verifiedAt: new Date().toISOString()
          },
        },
        'Email verificata con successo. Ora puoi effettuare il login.');

    } catch (error: any) {
      logger.error('Email verification error:', error);
      
      errorResponse(res, 
        'Verifica email fallita',
        'VERIFICATION_ERROR',
        undefined,
        500);
    }
  }

  /**
   * POST /auth/resend-verification
   * Resend email verification
   */
  static async resendVerification(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.body;

      // Find user by username or email (like login does)
      const user = await User.findOne({
        $or: [
          { username: username.toLowerCase() },
          { email: username.toLowerCase() }
        ]
      });

      if (!user) {
        // Don't reveal if email exists or not for security
        successResponse(res, 
          {
            emailSent: true,
            canResendAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          },
          'Se l\'indirizzo email esiste e non è verificato, un\'email di verifica è stata inviata.');
        return;
      }

      if (user.isEmailVerified) {
        errorResponse(res, 
          'Email già verificata',
          'EMAIL_ALREADY_VERIFIED',
          {
            canLogin: true,
            loginUrl: '/login'
          },
          400);
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

        errorResponse(res,
          'Impossibile inviare l\'email di verifica',
          'EMAIL_SEND_ERROR',
          undefined,
          500);
        return;
      }

      // DEV ONLY: Add verification URL header for testing
      if (process.env.NODE_ENV !== 'production') {
        const verificationUrl = `${process.env.BASE_URL || 'http://localhost:4000'}/?token=${emailVerificationToken}`;
        res.setHeader('X-Dev-Verification-Url', verificationUrl);
        logger.debug(`[DEV] Resend verification URL: ${verificationUrl}`);
      }

      logAuth('verification_email_resent', user.id, {
        username: user.username,
        email: user.email,
        ipAddress: req.ip
      });

      successResponse(res, 
        {
          emailSent: true,
          canResendAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes cooldown
          expiresAt: emailVerificationExpires.toISOString()
        },
        'Email di verifica inviata con successo');

    } catch (error: any) {
      logger.error('Resend verification error:', error);
      
      errorResponse(res, 
        'Impossibile rinviare l\'email di verifica',
        'RESEND_ERROR',
        undefined,
        500);
    }
  }
}