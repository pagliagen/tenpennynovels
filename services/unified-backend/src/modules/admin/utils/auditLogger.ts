// =============================================================================
// Sistema di Audit Logging per Management Backend
// =============================================================================

import { logger } from './logger';
import { getAuditActionDescription } from './permissions';
import { appConfig } from '@config/runtime';

interface AuditLogEntry {
  timestamp: Date;
  userId: string;
  username: string;
  action: string;
  actionDescription: string;
  resource?: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class AuditLoggerClass {
  private static instance: AuditLoggerClass;

  static getInstance(): AuditLoggerClass {
    if (!AuditLoggerClass.instance) {
      AuditLoggerClass.instance = new AuditLoggerClass();
    }
    return AuditLoggerClass.instance;
  }

  /**
   * Log di un'operazione con tutti i dettagli necessari
   */
  async logOperation(params: {
    userId: string;
    username: string;
    action: string;
    resource?: string;
    resourceId?: string;
    details?: any;
    request?: any; // Express request object
    success?: boolean;
    errorMessage?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }) {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      userId: params.userId,
      username: params.username,
      action: params.action,
      actionDescription: getAuditActionDescription(params.action),
      resource: params.resource,
      resourceId: params.resourceId,
      details: params.details,
      ipAddress: this.extractIpAddress(params.request),
      userAgent: params.request?.get('User-Agent'),
      success: params.success !== false, // Default true se non specificato
      errorMessage: params.errorMessage,
      severity: params.severity || this.calculateSeverity(params.action)
    };

    // Log nel formato strutturato per i file
    logger.info('AUDIT_LOG', {
      audit: entry,
      category: 'MANAGEMENT_AUDIT'
    });

    // Log nel formato leggibile per la console in development
    if (!appConfig.isProduction) {
      logger.info(
        `AUDIT: ${entry.username} (${entry.userId}) ` +
        `${entry.actionDescription} ${entry.resource ? `[${entry.resource}${entry.resourceId ? `#${entry.resourceId}` : ''}]` : ''} ` +
        `from ${entry.ipAddress} ${entry.success ? '' : `- ERROR: ${entry.errorMessage}`}`
      );
    }

    // Per operazioni critiche, invio notifica immediata
    if (entry.severity === 'critical') {
      await this.notifyCriticalOperation(entry);
    }
  }

  /**
   * Shortcut per log di operazioni riuscite
   */
  async logSuccess(params: {
    userId: string;
    username: string;
    action: string;
    resource?: string;
    resourceId?: string;
    details?: any;
    request?: any;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }) {
    await this.logOperation({ ...params, success: true });
  }

  /**
   * Shortcut per log di operazioni fallite
   */
  async logError(params: {
    userId: string;
    username: string;
    action: string;
    resource?: string;
    resourceId?: string;
    details?: any;
    request?: any;
    errorMessage: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }) {
    await this.logOperation({ ...params, success: false });
  }

  /**
   * Log specifico per accessi negati
   */
  async logAccessDenied(params: {
    userId: string;
    username: string;
    action: string;
    resource?: string;
    requiredPermission: string;
    request?: any;
  }) {
    await this.logOperation({
      ...params,
      action: 'access_denied',
      success: false,
      errorMessage: `Permission denied: requires ${params.requiredPermission}`,
      severity: 'medium',
      details: {
        attemptedAction: params.action,
        requiredPermission: params.requiredPermission
      }
    });
  }

  /**
   * Log azione amministrativa (backward compatibility)
   */
  async logAdminAction(params: {
    userId: string;
    username: string;
    action: string;
    resource?: string;
    resourceId?: string;
    details?: any;
    request?: any;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }) {
    await this.logSuccess(params);
  }

  /**
   * Generic log method (backward compatibility)
   * Adapts new actor/resource interface to logOperation interface
   */
  async log(params: {
    action: string;
    actorType?: string;
    actorId?: string;
    actorName?: string;
    resourceType?: string;
    resourceId?: string;
    targetType?: string;
    targetId?: string;
    targetName?: string;
    details?: any;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
    success?: boolean;
    errorMessage?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }) {
    // Adapt to logOperation interface
    await this.logOperation({
      userId: params.actorId || 'unknown',
      username: params.actorName || 'unknown',
      action: params.action,
      resource: params.resourceType || params.targetType,
      resourceId: params.resourceId || params.targetId,
      details: params.details || params.metadata,
      request: {
        ip: params.ipAddress,
        get: (header: string) => header === 'User-Agent' ? params.userAgent : undefined
      },
      success: params.success,
      errorMessage: params.errorMessage,
      severity: params.severity
    });
  }

  /**
   * Estrae l'IP address dalla request
   */
  private extractIpAddress(request: any): string {
    if (!request) return 'unknown';
    
    return request.ip || 
           request.connection?.remoteAddress || 
           request.socket?.remoteAddress ||
           request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           'unknown';
  }

  /**
   * Calcola la severity di un'azione in base al tipo
   * FIX: Usa exact match invece di includes per evitare falsi positivi
   */
  private calculateSeverity(action: string): 'low' | 'medium' | 'high' | 'critical' {
    // CRITICAL: Destructive actions, permanent changes
    const criticalActions = [
      'user.delete',
      'user.change_permissions',
      'character.delete',
      'location.delete',
      'document.delete',
      'skill.delete',
      'item.delete',
      'system.maintenance_mode',
      'system.config.update'
    ];

    // HIGH: Security-sensitive, impactful operations
    const highActions = [
      'user.ban',
      'user.role.grant',
      'user.role.revoke',
      'character.approve',
      'character.reject',
      'character.role.grant',
      'character.role.revoke',
      'character.permission.grant',
      'character.permission.revoke',
      'economy.adjust_balance',
      'system.broadcast',
      'system.export_data'
    ];

    // MEDIUM: Moderate impact operations
    const mediumActions = [
      'user.update',
      'user.deactivate',
      'character.update',
      'character.edit',
      'location.create',
      'location.update',
      'document.create',
      'document.update',
      'skill.create',
      'skill.update',
      'item.create',
      'item.update',
      'economy.grant_money'
    ];

    // FIX: Use exact match instead of includes to avoid false positives
    if (criticalActions.includes(action)) return 'critical';
    if (highActions.includes(action)) return 'high';
    if (mediumActions.includes(action)) return 'medium';
    return 'low';
  }

  /**
   * Ottieni icona per severity
   */
  private getSeverityIcon(severity: string): string {
    const icons = {
      low: '🟢',
      medium: '🟡', 
      high: '🟠',
      critical: '🔴'
    };
    return icons[severity as keyof typeof icons] || '⚪';
  }

  /**
   * Notifica per operazioni critiche con email alert
   */
  private async notifyCriticalOperation(entry: AuditLogEntry) {
    logger.error('CRITICAL_AUDIT_OPERATION', {
      audit: entry,
      category: 'SECURITY_ALERT'
    });

    const criticalMessage =
      `CRITICAL: ${entry.username} performed ${entry.actionDescription} ` +
      `on ${entry.resource}${entry.resourceId ? `#${entry.resourceId}` : ''} from ${entry.ipAddress}`;

    logger.error(criticalMessage);

    // Send email notification (non-blocking)
    try {
      const { EmailService } = await import('@core/auth/services/EmailService');
      const { appConfig } = await import('@config/runtime');

      if (!appConfig.admin.notificationEmail) {
        logger.warn('[AuditLogger] Admin email not configured, skipping email alert');
        return;
      }

      const emailSubject = `🚨 CRITICAL SECURITY ALERT - ${entry.actionDescription}`;
      const emailHtml = `
        <h2 style="color: #d32f2f;">Critical Security Operation Detected</h2>
        <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
          <tr style="background: #f5f5f5;">
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">User</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${entry.username} (${entry.userId})</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Action</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${entry.actionDescription}</td>
          </tr>
          <tr style="background: #f5f5f5;">
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Resource</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${entry.resource}${entry.resourceId ? ` #${entry.resourceId}` : ''}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">IP Address</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${entry.ipAddress}</td>
          </tr>
          <tr style="background: #f5f5f5;">
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Timestamp</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${entry.timestamp.toISOString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Status</td>
            <td style="padding: 8px; border: 1px solid #ddd; color: ${entry.success ? '#4caf50' : '#d32f2f'}; font-weight: bold;">
              ${entry.success ? '✅ SUCCESS' : '❌ FAILED'}
            </td>
          </tr>
        </table>
        <p style="margin-top: 20px; color: #666; font-size: 12px;">
          This is an automated security alert from Ten Penny Novels audit system.
        </p>
      `;

      await EmailService.sendEmail({
        to: appConfig.admin.notificationEmail,
        subject: emailSubject,
        html: emailHtml,
        text: criticalMessage + '\n\n' + JSON.stringify(entry, null, 2)
      });

      logger.info(`[AuditLogger] Critical email sent to ${appConfig.admin.notificationEmail}`);

    } catch (emailError: any) {
      // Email failure should NOT crash audit logging
      logger.error('[AuditLogger] Failed to send critical email:', emailError.message);
    }
  }

  /**
   * Middleware Express per audit automatico
   */
  createMiddleware() {
    return (req: any, res: any, next: any) => {
      // Aggiungi il metodo audit alla request per uso nei controller
      req.audit = {
        logSuccess: (action: string, details: any = {}) => {
          this.logSuccess({
            userId: req.user?.id || 'unknown',
            username: req.user?.username || 'unknown',
            action,
            details,
            request: req
          });
        },
        
        logError: (action: string, errorMessage: string, details: any = {}) => {
          this.logError({
            userId: req.user?.id || 'unknown',
            username: req.user?.username || 'unknown',
            action,
            errorMessage,
            details,
            request: req
          });
        },
        
        logAccessDenied: (action: string, requiredPermission: string) => {
          this.logAccessDenied({
            userId: req.user?.id || 'unknown',
            username: req.user?.username || 'unknown',
            action,
            requiredPermission,
            request: req
          });
        }
      };

      next();
    };
  }

}

// Export singleton instance
export const auditLogger = AuditLoggerClass.getInstance();

// Legacy compatibility - manteniamo la classe statica per eventuali usi esistenti
export class AuditLogger {
  static logSuccess = auditLogger.logSuccess.bind(auditLogger);
  static logError = auditLogger.logError.bind(auditLogger);
  static logOperation = auditLogger.logOperation.bind(auditLogger);
  static logAccessDenied = auditLogger.logAccessDenied.bind(auditLogger);
  static logAdminAction = auditLogger.logAdminAction.bind(auditLogger);
  static log = auditLogger.log.bind(auditLogger);
  static createMiddleware = auditLogger.createMiddleware.bind(auditLogger);
}