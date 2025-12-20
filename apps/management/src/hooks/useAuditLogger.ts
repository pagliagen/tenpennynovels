// =============================================================================
// useAuditLogger Hook - Simplified audit logging for React components
// =============================================================================

import { useAuth } from '@/contexts/AuthContext';
import { AuthContext } from '@/lib/auth';
import { 
  auditLogger, 
  logUserAction, 
  logCharacterAction, 
  logEconomyAction, 
  logLocationAction, 
  logSystemAction, 
  logContentAction,
  AuditLogEntry
} from '@/lib/auditLogger';

export function useAuditLogger(overrideAuthContext?: AuthContext) {
  // Try to use the provided authContext first, fallback to useAuth hook
  let authContext: AuthContext | null = null;
  
  if (overrideAuthContext) {
    authContext = overrideAuthContext;
  } else {
    try {
      authContext = useAuth();
    } catch (error) {
      // If useAuth fails (no provider), authContext remains null
      console.warn('useAuditLogger: useAuth failed, proceeding without auth context');
    }
  }

  /**
   * Create base audit entry with user information
   */
  const createBaseEntry = (action: string, section: string, details: any): Omit<AuditLogEntry, 'timestamp'> => ({
    action,
    section,
    details,
    userId: authContext?.user?.id,
    username: authContext?.user?.username,
  });

  /**
   * Log successful operation
   */
  const logSuccess = (action: string, section: string, details: any) => {
    auditLogger.logSuccess(createBaseEntry(action, section, details));
  };

  /**
   * Log failed operation
   */
  const logError = (action: string, section: string, details: any, error: string) => {
    auditLogger.logError({
      ...createBaseEntry(action, section, details),
      error
    });
  };

  /**
   * Log operation with custom success state
   */
  const log = (action: string, section: string, details: any, success?: boolean, error?: string) => {
    auditLogger.log({
      ...createBaseEntry(action, section, details),
      success,
      error
    });
  };

  /**
   * Convenience methods for common actions
   */
  const logCharacterApproval = (characterId: string, characterName: string, decision: 'approve' | 'reject', note?: string) => {
    const action = decision === 'approve' ? 'character.approve' : 'character.reject';
    logSuccess(action, 'characters', {
      characterId,
      characterName,
      decision,
      note
    });
  };

  const logUserBan = (userId: string, username: string, duration: string, reason: string, success: boolean) => {
    const details = { userId, username, duration, reason };
    if (success) {
      logSuccess('user.ban', 'users', details);
    } else {
      logError('user.ban', 'users', details, 'Ban operation failed');
    }
  };

  const logMoneyGrant = (recipientId: string, amount: number, reason: string, success: boolean) => {
    const details = { recipientId, amount, reason };
    if (success) {
      logSuccess('economy.grant_money', 'economy', details);
    } else {
      logError('economy.grant_money', 'economy', details, 'Money grant failed');
    }
  };

  const logLocationUpdate = (locationId: string, changes: any, success: boolean) => {
    const details = { locationId, changes };
    if (success) {
      logSuccess('location.update', 'locations', details);
    } else {
      logError('location.update', 'locations', details, 'Location update failed');
    }
  };

  const logSystemMaintenance = (enabled: boolean, message?: string) => {
    logSuccess('system.maintenance_mode', 'system', {
      enabled,
      message,
      action: enabled ? 'enable' : 'disable'
    });
  };

  const logContentPublish = (contentId: string, contentType: string, title: string) => {
    logSuccess('content.publish', 'content', {
      contentId,
      contentType,
      title
    });
  };

  /**
   * Log page/section access
   */
  const logPageAccess = (page: string, additionalInfo?: any) => {
    logSuccess('page.access', 'navigation', {
      page,
      ...additionalInfo
    });
  };

  /**
   * Log search operations
   */
  const logSearch = (searchType: string, query: string, resultsCount: number) => {
    logSuccess('search.perform', searchType, {
      query,
      resultsCount
    });
  };

  /**
   * Log export operations
   */
  const logExport = (exportType: string, format: string, filters?: any) => {
    logSuccess('export.perform', exportType, {
      format,
      filters
    });
  };

  /**
   * Log form submissions
   */
  const logFormSubmit = (formName: string, success: boolean, error?: string, data?: any) => {
    const details = { formName, data };
    if (success) {
      logSuccess('form.submit', 'forms', details);
    } else {
      logError('form.submit', 'forms', details, error || 'Form submission failed');
    }
  };

  /**
   * Log bulk operations
   */
  const logBulkOperation = (operationType: string, section: string, itemCount: number, success: boolean, error?: string) => {
    const details = { operationType, itemCount };
    if (success) {
      logSuccess('bulk.operation', section, details);
    } else {
      logError('bulk.operation', section, details, error || 'Bulk operation failed');
    }
  };

  /**
   * Generic action logger (compatibility method)
   */
  const logAction = (action: string, details: string) => {
    logSuccess(action, 'tickets', { details });
  };

  return {
    // Core logging functions
    logSuccess,
    logError,
    log,
    logAction,

    // Convenience methods for specific actions
    logCharacterApproval,
    logUserBan,
    logMoneyGrant,
    logLocationUpdate,
    logSystemMaintenance,
    logContentPublish,
    logPageAccess,
    logSearch,
    logExport,
    logFormSubmit,
    logBulkOperation,

    // Direct access to action loggers
    user: logUserAction,
    character: logCharacterAction,
    economy: logEconomyAction,
    location: logLocationAction,
    system: logSystemAction,
    content: logContentAction,

    // Utility methods
    flush: () => auditLogger.flush(),
    getPendingCount: () => auditLogger.getPendingCount()
  };
}