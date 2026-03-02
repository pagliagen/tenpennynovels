// =============================================================================
// Sistema di Audit Logging per Management Backend
// =============================================================================

import { logger } from './logger';
import { getAuditActionDescription } from './permissions';

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
  logOperation(params: {
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
    if (process.env.NODE_ENV === 'development') {
      const statusIcon = entry.success ? '✅' : '❌';
      const severityIcon = this.getSeverityIcon(entry.severity);
      
      console.log(
        `${statusIcon} ${severityIcon} AUDIT: ${entry.username} (${entry.userId}) ` +
        `${entry.actionDescription} ${entry.resource ? `[${entry.resource}${entry.resourceId ? `#${entry.resourceId}` : ''}]` : ''} ` +
        `from ${entry.ipAddress} ${entry.success ? '' : `- ERROR: ${entry.errorMessage}`}`
      );
    }

    // Per operazioni critiche, invio notifica immediata (TODO: implementare webhook/email)
    if (entry.severity === 'critical') {
      this.notifyCriticalOperation(entry);
    }
  }

  /**
   * Shortcut per log di operazioni riuscite
   */
  logSuccess(params: {
    userId: string;
    username: string;
    action: string;
    resource?: string;
    resourceId?: string;
    details?: any;
    request?: any;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }) {
    this.logOperation({ ...params, success: true });
  }

  /**
   * Shortcut per log di operazioni fallite
   */
  logError(params: {
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
    this.logOperation({ ...params, success: false });
  }

  /**
   * Log specifico per accessi negati
   */
  logAccessDenied(params: {
    userId: string;
    username: string;
    action: string;
    resource?: string;
    requiredPermission: string;
    request?: any;
  }) {
    this.logOperation({
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
  logAdminAction(params: {
    userId: string;
    username: string;
    action: string;
    resource?: string;
    resourceId?: string;
    details?: any;
    request?: any;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }) {
    this.logSuccess(params);
  }

  /**
   * Generic log method (backward compatibility)
   * Adapts new actor/resource interface to logOperation interface
   */
  log(params: {
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
    this.logOperation({
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
   */
  private calculateSeverity(action: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalActions = [
      'user.delete', 'user.change_permissions', 'character.delete',
      'system.maintenance_mode', 'location.delete'
    ];
    
    const highActions = [
      'user.ban', 'character.reject', 'economy.adjust_balance',
      'system.broadcast', 'system.export_data'
    ];
    
    const mediumActions = [
      'user.update', 'character.approve', 'character.edit',
      'economy.grant_money', 'location.create', 'location.update'
    ];

    if (criticalActions.some(a => action.includes(a))) return 'critical';
    if (highActions.some(a => action.includes(a))) return 'high';
    if (mediumActions.some(a => action.includes(a))) return 'medium';
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
   * Notifica per operazioni critiche (placeholder per future implementazioni)
   */
  private notifyCriticalOperation(entry: AuditLogEntry) {
    logger.error('CRITICAL_AUDIT_OPERATION', {
      audit: entry,
      category: 'SECURITY_ALERT'
    });
    
    // TODO: Implementare notifiche via webhook, email, Slack, etc.
    console.error(
      `🚨 CRITICAL OPERATION: ${entry.username} performed ${entry.actionDescription} ` +
      `${entry.resource ? `on ${entry.resource}${entry.resourceId ? `#${entry.resourceId}` : ''}` : ''} ` +
      `from ${entry.ipAddress}`
    );
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