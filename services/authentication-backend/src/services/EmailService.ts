import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { ConfigurationService } from '../../../../packages/shared/src/services/ConfigurationService';
import { Redis } from 'ioredis';

export class EmailService {
  private static transporter: nodemailer.Transporter;
  private static isMockMode: boolean;
  private static configService: ConfigurationService;

  /**
   * Initialize Email Service with Configuration Service
   * @param redisClient - Redis client for caching
   */
  static initialize(redisClient?: Redis) {
    this.isMockMode = process.env.EMAIL_MOCK === 'true';

    // Initialize ConfigurationService if Redis client is provided
    if (redisClient) {
      this.configService = new ConfigurationService(redisClient, logger);
      logger.info('EmailService initialized with ConfigurationService');
    } else {
      logger.warn('EmailService initialized without ConfigurationService - templates will fail');
    }
    
    if (this.isMockMode) {
      logger.info('Email service initialized in MOCK mode - emails will be logged instead of sent');
      return;
    }
    const emailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true' || parseInt(process.env.SMTP_PORT || '587') === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      },
      connectionTimeout: 5000, // 5 seconds timeout for SMTP connection
      greetingTimeout: 5000,   // 5 seconds timeout for greeting message
      socketTimeout: 5000       // 5 seconds timeout for socket inactivity
    };

    this.transporter = nodemailer.createTransport(emailConfig);

    // Verify connection
    this.transporter.verify((error, success) => {
      if (error) {
        logger.error('Email service configuration error:', error);
      } else {
        logger.info('Email service ready');
      }
    });
  }

  /**
   * Send email verification message
   */
  static async sendVerificationEmail(email: string, displayName: string, token: string): Promise<void> {
    try {
      const verificationUrl = `${process.env.BASE_URL || 'http://localhost:4000'}/verify-email/${token}`;

      // Get template from database
      const template = await this.configService.getConfig('email_template_verification');

      if (!template) {
        throw new Error('Email template not found: email_template_verification');
      }

      // Replace placeholders
      const subject = template.subject;
      const html = this.replacePlaceholders(template.html, { displayName, verificationUrl });
      const text = this.replacePlaceholders(template.text, { displayName, verificationUrl });

      if (this.isMockMode) {
        logger.info('=== MOCK EMAIL - Email Verification ===');
        logger.info(`To: ${email}`);
        logger.info(`Display Name: ${displayName}`);
        logger.info(`Subject: ${subject}`);
        logger.info(`Verification Token: ${token}`);
        logger.info(`Verification URL: ${verificationUrl}`);
        logger.info('--- EMAIL TEXT CONTENT ---');
        logger.info(text);
        logger.info('=== END MOCK EMAIL ===');
        return;
      }

      const mailOptions = {
        from: {
          name: 'TenpennyNovels',
          address: process.env.EMAIL_FROM || 'info@tenpennynovels.com'
        },
        to: email,
        subject,
        html,
        text
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Verification email sent successfully to ${email}`);

    } catch (error: any) {
      logger.error(`Failed to send verification email to ${email}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        email,
        displayName
      });
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(email: string, displayName: string, token: string): Promise<void> {
    try {
      const resetUrl = `${process.env.BASE_URL || 'http://localhost:4000'}/reset-password/${token}`;

      // Get template from database
      const template = await this.configService.getConfig('email_template_password_reset');

      if (!template) {
        throw new Error('Email template not found: email_template_password_reset');
      }

      // Replace placeholders
      const subject = template.subject;
      const html = this.replacePlaceholders(template.html, { displayName, resetUrl });
      const text = this.replacePlaceholders(template.text, { displayName, resetUrl });

      if (this.isMockMode) {
        logger.info('=== MOCK EMAIL - Password Reset ===');
        logger.info(`To: ${email}`);
        logger.info(`Display Name: ${displayName}`);
        logger.info(`Subject: ${subject}`);
        logger.info(`Reset Token: ${token}`);
        logger.info(`Reset URL: ${resetUrl}`);
        logger.info('--- EMAIL TEXT CONTENT ---');
        logger.info(text);
        logger.info('=== END MOCK EMAIL ===');
        return;
      }

      const mailOptions = {
        from: {
          name: 'TenpennyNovels',
          address: process.env.EMAIL_FROM || 'info@tenpennynovels.com'
        },
        to: email,
        subject,
        html,
        text
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Password reset email sent successfully to ${email}`);

    } catch (error: any) {
      logger.error(`Failed to send password reset email to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Send security alert email
   */
  static async sendSecurityAlert(email: string, displayName: string, alertType: string, details: any): Promise<void> {
    try {
      // Get template from database
      const template = await this.configService.getConfig('email_template_security_alert');

      if (!template) {
        throw new Error('Email template not found: email_template_security_alert');
      }

      // Convert details object to string if needed
      const detailsString = typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details);

      // Replace placeholders
      const subject = template.subject;
      const html = this.replacePlaceholders(template.html, { displayName, alertType, details: detailsString });
      const text = this.replacePlaceholders(template.text, { displayName, alertType, details: detailsString });

      if (this.isMockMode) {
        logger.info('=== MOCK EMAIL - Security Alert ===');
        logger.info(`To: ${email}`);
        logger.info(`Display Name: ${displayName}`);
        logger.info(`Subject: ${subject}`);
        logger.info(`Alert Type: ${alertType}`);
        logger.info(`Details: ${detailsString}`);
        logger.info('--- EMAIL TEXT CONTENT ---');
        logger.info(text);
        logger.info('=== END MOCK EMAIL ===');
        return;
      }

      const mailOptions = {
        from: {
          name: 'TenpennyNovels Security',
          address: process.env.EMAIL_FROM || 'info@tenpennynovels.com'
        },
        to: email,
        subject,
        html,
        text
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Security alert email sent successfully to ${email}`);

    } catch (error: any) {
      logger.error(`Failed to send security alert email to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Send account deletion confirmation email
   */
  static async sendAccountDeletionEmail(email: string, displayName: string, token: string): Promise<void> {
    try {
      const deletionUrl = `${process.env.BASE_URL || 'http://localhost:4000'}/delete-account/${token}`;

      // Get template from database
      const template = await this.configService.getConfig('email_template_account_deletion');

      if (!template) {
        throw new Error('Email template not found: email_template_account_deletion');
      }

      // Replace placeholders
      const subject = template.subject;
      const html = this.replacePlaceholders(template.html, { displayName, deletionUrl });
      const text = this.replacePlaceholders(template.text, { displayName, deletionUrl });

      if (this.isMockMode) {
        logger.info('=== MOCK EMAIL - Account Deletion ===');
        logger.info(`To: ${email}`);
        logger.info(`Display Name: ${displayName}`);
        logger.info(`Subject: ${subject}`);
        logger.info(`Deletion Token: ${token}`);
        logger.info(`Deletion URL: ${deletionUrl}`);
        logger.info('--- EMAIL TEXT CONTENT ---');
        logger.info(text);
        logger.info('=== END MOCK EMAIL ===');
        return;
      }

      const mailOptions = {
        from: {
          name: 'TenpennyNovels',
          address: process.env.EMAIL_FROM || 'info@tenpennynovels.com'
        },
        to: email,
        subject,
        html,
        text
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Account deletion email sent successfully to ${email}`);

    } catch (error: any) {
      logger.error(`Failed to send account deletion email to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Replace placeholders in template string
   *
   * Replaces {placeholder} syntax with actual values
   * Example: "Hello {displayName}" with {displayName: "John"} => "Hello John"
   *
   * @param template - Template string with {placeholder} syntax
   * @param placeholders - Object with placeholder values
   * @returns Template with placeholders replaced
   */
  private static replacePlaceholders(template: string, placeholders: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(placeholders)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }

}

// ============================================================================
// NOTE: All email templates are now stored in the database
// ============================================================================
// Templates are stored in SystemConfiguration model and fetched via ConfigurationService.
// Template keys:
// - email_template_verification
// - email_template_password_reset
// - email_template_security_alert
// - email_template_account_deletion
//
// To update templates:
// 1. Use Management API: PATCH /system/config/:configKey
// 2. Or update directly in database via seed script: npm run seed:system-config
// ============================================================================
