import { Request, Response } from 'express';
import { User, Character, db } from '@database/models';
import { CryptoUtils } from '../utils/crypto';
import { ApiResponse } from '../types/auth';
import { logger, logAuth } from '../logger';
import { redis } from '@config/runtime/redis';
import { EmailService } from '../services/EmailService';
import { errorResponse, successResponse, createResponse } from '@shared/utils/apiResponse';
import { appConfig } from '@config/runtime';

export class RegistrationController {
  /**
   * POST /auth/register
   * Register new user with email verification
   */
  static async register(req: Request, res: Response): Promise<void> {
    const session = await db.getConnection().startSession();
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

        res.status(400).json(errorResponse( 
          'Username già esistente',
          'USERNAME_TAKEN',
          { suggestions },
          409));
        return;
      }

      // Check if email already exists
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        res.status(400).json(errorResponse( 
          'Indirizzo email già registrato',
          'EMAIL_TAKEN',
          {
            canRecover: true,
            message: 'If you forgot your password, you can reset it using the password recovery option.'
          },
          409));
        return;
      }

      // Hash password
      const passwordHash = await CryptoUtils.hashPassword(password);

      // Generate email verification token
      const emailVerificationToken = CryptoUtils.generateSecureToken();
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Capture referrer for analytics
      const referrer = (req.headers.referer || req.query.utm_source as string || 'organic');

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
        metadata: {
          referrer,
          registeredAt: new Date()
        },
        preferences: {
          emailNotifications: true,
          marketingEmails: subscribeNewsletter || false,
          theme: 'victorian_dark',
          language: 'en',
          timezone: 'Europe/London'
        }
      });

      // User + default character must exist together: without a character the
      // player has no way to reach the wizard and no client-side path to create
      // one later (see incidente 2026-07-27). Roll back both on any failure
      // instead of leaving an orphaned User.
      let defaultCharacter;
      session.startTransaction();
      try {
        await user.save({ session });

        defaultCharacter = new Character({
          userId: user.id,
          name: user.username,
          playerStatus: 'draft',
          gameplayRoles: ['player'],
          skills: {},
          isActive: false,
          submittedAt: new Date()
        });

        await defaultCharacter.save({ session });

        await session.commitTransaction();

        logger.info(`User and default character created: ${user.username} / ${defaultCharacter.id}`);
      } catch (registrationTxError) {
        await session.abortTransaction();
        throw registrationTxError;
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
      if (!appConfig.isProduction) {
        const verificationUrl = `${appConfig.urls.landing}/?token=${emailVerificationToken}`;
        res.setHeader('X-Dev-Verification-Url', verificationUrl);
        logger.debug(`[DEV] Verification URL: ${verificationUrl}`);
      }

      res.status(201).json(createResponse( 
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
        'Registrazione completata con successo. Controlla la tua email per verificare il tuo account.'));

    } catch (error: any) {
      logger.error('Registration error:', error);

      res.status(400).json(errorResponse(
        'Registrazione fallita',
        'REGISTRATION_ERROR',
        undefined,
        500));
    } finally {
      await session.endSession();
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

      res.status(200).json(successResponse(
        { availability },
        undefined));

    } catch (error: any) {
      logger.error('Availability check error:', error);

      res.status(400).json(errorResponse(
        'Controllo disponibilità fallito',
        'AVAILABILITY_ERROR',
        undefined,
        500));
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
        res.status(400).json(errorResponse(
          'Username richiesto',
          'VALIDATION_ERROR',
          undefined,
          400));
        return;
      }

      const existingUsername = await User.findOne({ username: username.toLowerCase() });

      res.status(200).json(successResponse(
        {
          available: !existingUsername,
          suggestions: existingUsername ? [
            `${username}_alt`,
            `${username}_${new Date().getFullYear()}`,
            `${username}_player`
          ] : undefined
        },
        undefined));

    } catch (error: any) {
      logger.error('Username check error:', error);

      res.status(400).json(errorResponse(
        'Controllo username fallito',
        'USERNAME_CHECK_ERROR',
        undefined,
        500));
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
        res.status(400).json(errorResponse(
          'Email richiesta',
          'VALIDATION_ERROR',
          undefined,
          400));
        return;
      }

      const existingEmail = await User.findOne({ email: email.toLowerCase() });

      res.status(200).json(successResponse(
        {
          available: !existingEmail
        },
        undefined));

    } catch (error: any) {
      logger.error('Email check error:', error);

      res.status(400).json(errorResponse(
        'Controllo email fallito',
        'EMAIL_CHECK_ERROR',
        undefined,
        500));
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
        res.status(400).json(errorResponse( 
          'Token di verifica non valido o scaduto',
          'INVALID_VERIFICATION_TOKEN',
          {
            canResend: true,
            resendUrl: '/auth/resend-verification'
          },
          400));
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

      res.status(200).json(successResponse( 
        {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            isEmailVerified: user.isEmailVerified,
            verifiedAt: new Date().toISOString()
          },
        },
        'Email verificata con successo. Ora puoi effettuare il login.'));

    } catch (error: any) {
      logger.error('Email verification error:', error);
      
      res.status(400).json(errorResponse( 
        'Verifica email fallita',
        'VERIFICATION_ERROR',
        undefined,
        500));
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
        res.status(200).json(successResponse( 
          {
            emailSent: true,
            canResendAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          },
          'Se l\'indirizzo email esiste e non è verificato, un\'email di verifica è stata inviata.'));
        return;
      }

      if (user.isEmailVerified) {
        res.status(400).json(errorResponse( 
          'Email già verificata',
          'EMAIL_ALREADY_VERIFIED',
          {
            canLogin: true,
            loginUrl: '/login'
          },
          400));
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

        res.status(400).json(errorResponse(
          'Impossibile inviare l\'email di verifica',
          'EMAIL_SEND_ERROR',
          undefined,
          500));
        return;
      }

      // DEV ONLY: Add verification URL header for testing
      if (!appConfig.isProduction) {
        const verificationUrl = `${appConfig.urls.landing}/?token=${emailVerificationToken}`;
        res.setHeader('X-Dev-Verification-Url', verificationUrl);
        logger.debug(`[DEV] Resend verification URL: ${verificationUrl}`);
      }

      logAuth('verification_email_resent', user.id, {
        username: user.username,
        email: user.email,
        ipAddress: req.ip
      });

      res.status(200).json(successResponse( 
        {
          emailSent: true,
          canResendAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes cooldown
          expiresAt: emailVerificationExpires.toISOString()
        },
        'Email di verifica inviata con successo'));

    } catch (error: any) {
      logger.error('Resend verification error:', error);
      
      res.status(400).json(errorResponse( 
        'Impossibile rinviare l\'email di verifica',
        'RESEND_ERROR',
        undefined,
        500));
    }
  }
}