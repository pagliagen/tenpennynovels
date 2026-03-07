import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { ConfigurationService } from '@shared/services/ConfigurationService';
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
      this.configService = new ConfigurationService(redisClient as any, logger);
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
      const verificationUrl = `${process.env.BASE_URL || 'http://localhost:4000'}/?token=${token}`;

      let subject: string;
      let html: string;
      let text: string;

      // Get template from database if ConfigurationService is available
      if (this.configService) {
        const template = await this.configService.getConfig('email_template_verification');

        if (!template) {
          throw new Error('Email template not found: email_template_verification');
        }

        // Replace placeholders
        subject = template.subject;
        html = this.replacePlaceholders(template.html, { displayName, verificationUrl });
        text = this.replacePlaceholders(template.text, { displayName, verificationUrl });
      } else {
        // Fallback template when ConfigurationService is not available
        subject = 'Verifica il tuo account - Ten Penny Novels';
        text = `Caro ${displayName},\n\nBenvenuto su Ten Penny Novels!\n\nPer favore verifica il tuo account cliccando sul seguente link:\n${verificationUrl}\n\nSe non hai richiesto questa registrazione, ignora questa email.\n\nCordiali saluti,\nIl Team di Ten Penny Novels`;
        html = this.buildEmailHtml({
          title: 'Benvenuto su Ten Penny Novels!',
          bodyHtml: `
                <p style="margin: 0 0 16px; color: #d4c4b0;">Caro <strong style="color: #f5f5dc;">${displayName}</strong>,</p>
                <p style="margin: 0 0 8px;">Per favore verifica il tuo account cliccando sul pulsante qui sotto:</p>`,
          cta: { text: 'Verifica Account', url: verificationUrl },
          alternativeUrl: verificationUrl,
          footerExtra: 'Se non hai richiesto questa registrazione, ignora questa email.',
        });
      }

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
          name: 'Ten Penny Novels',
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

      let subject: string;
      let html: string;
      let text: string;

      // Get template from database if ConfigurationService is available
      if (this.configService) {
        const template = await this.configService.getConfig('email_template_password_reset');

        if (!template) {
          throw new Error('Email template not found: email_template_password_reset');
        }

        // Replace placeholders
        subject = template.subject;
        html = this.replacePlaceholders(template.html, { displayName, resetUrl });
        text = this.replacePlaceholders(template.text, { displayName, resetUrl });
      } else {
        // Fallback template when ConfigurationService is not available
        subject = 'Reset Password - Ten Penny Novels';
        text = `Caro ${displayName},\n\nHai richiesto il reset della tua password.\n\nClicca sul seguente link per reimpostare la password:\n${resetUrl}\n\nQuesto link scadrà tra 1 ora.\n\nSe non hai richiesto questo reset, ignora questa email.\n\nCordiali saluti,\nIl Team di Ten Penny Novels`;
        html = this.buildEmailHtml({
          title: 'Reset Password',
          bodyHtml: `
                <p style="margin: 0 0 16px; color: #d4c4b0;">Caro <strong style="color: #f5f5dc;">${displayName}</strong>,</p>
                <p style="margin: 0 0 8px;">Hai richiesto il reset della tua password. Clicca sul pulsante qui sotto per reimpostarla:</p>
                <p style="margin: 16px 0 0; font-size: 13px; color: #FFA748;"><strong>Questo link scadr&agrave; tra 1 ora.</strong></p>`,
          cta: { text: 'Reimposta Password', url: resetUrl },
          alternativeUrl: resetUrl,
          footerExtra: 'Se non hai richiesto questo reset, ignora questa email.',
        });
      }

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
          name: 'Ten Penny Novels',
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
      // Convert details object to string if needed
      const detailsString = typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details);

      let subject: string;
      let html: string;
      let text: string;

      // Get template from database if ConfigurationService is available
      if (this.configService) {
        const template = await this.configService.getConfig('email_template_security_alert');

        if (!template) {
          throw new Error('Email template not found: email_template_security_alert');
        }

        // Replace placeholders
        subject = template.subject;
        html = this.replacePlaceholders(template.html, { displayName, alertType, details: detailsString });
        text = this.replacePlaceholders(template.text, { displayName, alertType, details: detailsString });
      } else {
        // Fallback template when ConfigurationService is not available
        subject = 'Avviso di Sicurezza - Ten Penny Novels';
        text = `Caro ${displayName},\n\nAbbiamo rilevato un'attività sospetta sul tuo account.\n\nTipo di allerta: ${alertType}\n\nDettagli:\n${detailsString}\n\nSe riconosci questa attività, puoi ignorare questa email. Altrimenti, ti consigliamo di cambiare la tua password immediatamente.\n\nCordiali saluti,\nIl Team di Ten Penny Novels`;
        html = this.buildEmailHtml({
          title: 'Avviso di Sicurezza',
          bodyHtml: `
                <p style="margin: 0 0 16px; color: #d4c4b0;">Caro <strong style="color: #f5f5dc;">${displayName}</strong>,</p>
                <p style="margin: 0 0 16px;">Abbiamo rilevato un'attivit&agrave; sospetta sul tuo account.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 16px 0; background-color: #151515; border: 1px solid #1a1a1a; border-radius: 6px;">
                  <tr>
                    <td style="padding: 16px 20px;">
                      <p style="margin: 0 0 8px; font-size: 13px; color: #a89884; text-transform: uppercase; letter-spacing: 1px;">Tipo di allerta</p>
                      <p style="margin: 0 0 16px; font-size: 15px; color: #c1272d; font-weight: bold;">${alertType}</p>
                      <p style="margin: 0 0 8px; font-size: 13px; color: #a89884; text-transform: uppercase; letter-spacing: 1px;">Dettagli</p>
                      <pre style="margin: 0; font-size: 13px; color: #d4c4b0; white-space: pre-wrap; word-break: break-all; font-family: 'Courier New', Courier, monospace;">${detailsString}</pre>
                    </td>
                  </tr>
                </table>
                <p style="margin: 0;">Se riconosci questa attivit&agrave;, puoi ignorare questa email. Altrimenti, ti consigliamo di <strong style="color: #c1272d;">cambiare la tua password immediatamente</strong>.</p>`,
        });
      }

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
          name: 'Ten Penny Novels Security',
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

      let subject: string;
      let html: string;
      let text: string;

      // Get template from database if ConfigurationService is available
      if (this.configService) {
        const template = await this.configService.getConfig('email_template_account_deletion');

        if (!template) {
          throw new Error('Email template not found: email_template_account_deletion');
        }

        // Replace placeholders
        subject = template.subject;
        html = this.replacePlaceholders(template.html, { displayName, deletionUrl });
        text = this.replacePlaceholders(template.text, { displayName, deletionUrl });
      } else {
        // Fallback template when ConfigurationService is not available
        subject = 'Conferma Cancellazione Account - Ten Penny Novels';
        text = `Caro ${displayName},\n\nHai richiesto la cancellazione del tuo account Ten Penny Novels.\n\nPer confermare questa operazione, clicca sul seguente link:\n${deletionUrl}\n\nQuesta azione è irreversibile e tutti i tuoi dati verranno eliminati permanentemente.\n\nSe non hai richiesto questa cancellazione, ignora questa email.\n\nCordiali saluti,\nIl Team di Ten Penny Novels`;
        html = this.buildEmailHtml({
          title: 'Conferma Cancellazione Account',
          bodyHtml: `
                <p style="margin: 0 0 16px; color: #d4c4b0;">Caro <strong style="color: #f5f5dc;">${displayName}</strong>,</p>
                <p style="margin: 0 0 8px;">Hai richiesto la cancellazione del tuo account Ten Penny Novels.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 16px 0; background-color: #1a0a0a; border: 1px solid #c1272d; border-radius: 6px;">
                  <tr>
                    <td style="padding: 14px 20px; text-align: center;">
                      <p style="margin: 0; font-size: 14px; color: #c1272d; font-weight: bold;">Questa azione &egrave; irreversibile e tutti i tuoi dati verranno eliminati permanentemente.</p>
                    </td>
                  </tr>
                </table>`,
          cta: { text: 'Conferma Cancellazione', url: deletionUrl, color: '#c1272d' },
          alternativeUrl: deletionUrl,
          footerExtra: 'Se non hai richiesto questa cancellazione, ignora questa email.',
        });
      }

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
          name: 'Ten Penny Novels',
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

  private static readonly LOGO_URL = 'https://tenpennynovels.com/images/title.png';

  private static buildEmailHtml(options: {
    title: string;
    bodyHtml: string;
    cta?: { text: string; url: string; color?: string };
    alternativeUrl?: string;
    footerExtra?: string;
  }): string {
    const { title, bodyHtml, cta, alternativeUrl, footerExtra } = options;
    const btnColor = cta?.color || '#067368';
    const btnHoverColor = cta?.color === '#c1272d' ? '#a01f25' : '#08857a';

    const ctaHtml = cta ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 32px auto 0;">
                <tr>
                  <td style="border-radius: 6px; background-color: ${btnColor};">
                    <a href="${cta.url}" target="_blank" style="display: inline-block; padding: 14px 36px; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; font-weight: bold; color: #f5f5dc; text-decoration: none; border-radius: 6px; border: 1px solid ${btnHoverColor};">${cta.text}</a>
                  </td>
                </tr>
              </table>` : '';

    const altUrlHtml = alternativeUrl ? `
              <p style="margin: 24px 0 0; font-size: 13px; color: #a89884; line-height: 1.5;">
                Oppure copia e incolla questo link nel tuo browser:<br>
                <a href="${alternativeUrl}" style="color: #FFA748; word-break: break-all; text-decoration: underline;">${alternativeUrl}</a>
              </p>` : '';

    const footerExtraHtml = footerExtra
      ? `<p style="margin: 12px 0 0; font-size: 13px; color: #a89884; line-height: 1.5;">${footerExtra}</p>`
      : '';

    return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #050505; font-family: Georgia, 'Times New Roman', serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #050505;">
    <tr>
      <td style="padding: 40px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 8px; overflow: hidden;">
          <!-- Header: logo + title side by side -->
          <tr>
            <td style="padding: 24px 32px; background-color: #0a0a0a;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="width: 140px; vertical-align: middle;">
                    <img src="${this.LOGO_URL}" alt="Ten Penny Novels" width="130" style="max-width: 130px; height: auto; display: block;">
                  </td>
                  <td style="vertical-align: middle; padding-left: 20px;">
                    <h2 style="margin: 0; font-size: 21px; font-weight: bold; color: #d4af37; font-family: Georgia, 'Times New Roman', serif; line-height: 1.3;">${title}</h2>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Gold separator -->
          <tr>
            <td style="padding: 0 32px;">
              <div style="height: 1px; background: linear-gradient(to right, transparent, #d4af37, transparent);"></div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 28px 32px 32px;">
              <div style="font-size: 15px; line-height: 1.6; color: #f5f5dc; font-family: Georgia, 'Times New Roman', serif;">
                ${bodyHtml}
              </div>
              ${ctaHtml}
              ${altUrlHtml}
            </td>
          </tr>
          <!-- Footer separator -->
          <tr>
            <td style="padding: 0 32px;">
              <div style="height: 1px; background-color: #1a1a1a;"></div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px 24px; text-align: center;">
              ${footerExtraHtml}
              <p style="margin: 0; font-size: 12px; color: #6b5d50; line-height: 1.5; font-family: Georgia, 'Times New Roman', serif;">
                Cordiali saluti,<br>
                <span style="color: #a89884;">Il Team di Ten Penny Novels</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
// 2. Or update directly in database via MongoDB/Admin Panel
// ============================================================================
