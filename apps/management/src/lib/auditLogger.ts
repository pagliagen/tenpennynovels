// =============================================================================
// Frontend Audit Logger
// =============================================================================

import { apiRequest } from './auth';

export interface AuditLogEntry {
  action: string;
  section: string;
  details: Record<string, any>;
  success?: boolean;
  error?: string;
  userId?: string;
  username?: string;
  timestamp?: Date;
  userAgent?: string;
  ipAddress?: string;
}

export class FrontendAuditLogger {
  private static instance: FrontendAuditLogger;
  private pendingLogs: AuditLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private isOnline = true;
  private isInitialized = false;

  constructor() {
    // Only initialize if we're in the browser
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize() {
    if (this.isInitialized) return;
    
    this.startFlushTimer();
    this.setupEventListeners();
    this.isInitialized = true;
  }

  public static getInstance(): FrontendAuditLogger {
    if (!FrontendAuditLogger.instance) {
      FrontendAuditLogger.instance = new FrontendAuditLogger();
    }
    return FrontendAuditLogger.instance;
  }

  /**
   * Log a successful operation
   */
  public logSuccess(entry: Omit<AuditLogEntry, 'success' | 'timestamp'>): void {
    this.addLog({
      ...entry,
      success: true,
      timestamp: new Date(),
    });
  }

  /**
   * Log a failed operation
   */
  public logError(entry: Omit<AuditLogEntry, 'success' | 'timestamp'> & { error: string }): void {
    this.addLog({
      ...entry,
      success: false,
      timestamp: new Date(),
    });
  }

  /**
   * Log a generic operation
   */
  public log(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    this.addLog({
      ...entry,
      timestamp: new Date(),
    });
  }

  /**
   * Add log entry to pending queue
   */
  private addLog(entry: AuditLogEntry): void {
    // Ensure initialization in browser
    if (typeof window !== 'undefined' && !this.isInitialized) {
      this.initialize();
    }

    // Add browser information
    const enrichedEntry: AuditLogEntry = {
      ...entry,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
      // IP address will be detected server-side
    };

    this.pendingLogs.push(enrichedEntry);

    // If queue is getting full or critical action, flush immediately
    if (this.pendingLogs.length >= 10 || this.isCriticalAction(entry.action)) {
      this.flushLogs();
    }
  }

  /**
   * Check if action requires immediate logging
   */
  private isCriticalAction(action: string): boolean {
    const criticalActions = [
      'user.delete',
      'user.ban',
      'user.change_permissions',
      'character.delete',
      'system.maintenance_mode',
      'economy.grant_money',
      'location.delete'
    ];
    return criticalActions.includes(action);
  }

  /**
   * Send logs to backend
   */
  private async flushLogs(): Promise<void> {
    if (typeof window === 'undefined' || this.pendingLogs.length === 0 || !this.isOnline) {
      return;
    }

    const logsToSend = [...this.pendingLogs];
    this.pendingLogs = [];

    try {
      const response = await apiRequest('/admin/system/audit-logs', {
        method: 'POST',
        body: JSON.stringify({
          logs: logsToSend
        })
      });

      if (!response.success) {
        console.error('Failed to send audit logs:', response.error);
        // Re-add logs to queue for retry
        this.pendingLogs.unshift(...logsToSend);
      }
    } catch (error) {
      console.error('Error sending audit logs:', error);
      // Re-add logs to queue for retry
      this.pendingLogs.unshift(...logsToSend);
      this.isOnline = false;
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    if (typeof window === 'undefined') return;
    
    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, 30000); // Flush every 30 seconds
  }

  /**
   * Setup event listeners for browser events
   */
  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;
    
    // Flush logs before page unload
    window.addEventListener('beforeunload', () => {
      if (this.pendingLogs.length > 0 && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        // Use sendBeacon for reliable logging on page unload
        navigator.sendBeacon(
          `${process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com'}/admin/system/audit-logs`,
          JSON.stringify({ logs: this.pendingLogs })
        );
      }
    });

    // Handle online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushLogs();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Clear interval on page unload
    window.addEventListener('beforeunload', () => {
      if (this.flushInterval) {
        clearInterval(this.flushInterval);
      }
    });
  }

  /**
   * Force flush all pending logs
   */
  public async flush(): Promise<void> {
    await this.flushLogs();
  }

  /**
   * Get pending logs count (for debugging)
   */
  public getPendingCount(): number {
    return this.pendingLogs.length;
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Get singleton instance
 */
export const auditLogger = FrontendAuditLogger.getInstance();

/**
 * Log user management actions
 */
export const logUserAction = {
  update: (details: any) => auditLogger.logSuccess({
    action: 'user.update', 
    section: 'users',
    details
  }),
  ban: (details: any) => auditLogger.logSuccess({
    action: 'user.ban',
    section: 'users',
    details
  }),
  delete: (details: any) => auditLogger.logSuccess({
    action: 'user.delete',
    section: 'users', 
    details
  }),
  changePermissions: (details: any) => auditLogger.logSuccess({
    action: 'user.change_permissions',
    section: 'users',
    details
  })
};

/**
 * Log character management actions
 */
export const logCharacterAction = {
  approve: (details: any) => auditLogger.logSuccess({
    action: 'character.approve',
    section: 'characters',
    details
  }),
  reject: (details: any) => auditLogger.logSuccess({
    action: 'character.reject',
    section: 'characters',
    details
  }),
  edit: (details: any) => auditLogger.logSuccess({
    action: 'character.edit',
    section: 'characters',
    details
  }),
  delete: (details: any) => auditLogger.logSuccess({
    action: 'character.delete',
    section: 'characters',
    details
  })
};

/**
 * Log economy actions
 */
export const logEconomyAction = {
  grantMoney: (details: any) => auditLogger.logSuccess({
    action: 'economy.grant_money',
    section: 'economy',
    details
  }),
  adjustBalance: (details: any) => auditLogger.logSuccess({
    action: 'economy.adjust_balance',
    section: 'economy',
    details
  })
};

/**
 * Log location actions
 */
export const logLocationAction = {
  create: (details: any) => auditLogger.logSuccess({
    action: 'location.create',
    section: 'locations',
    details
  }),
  update: (details: any) => auditLogger.logSuccess({
    action: 'location.update',
    section: 'locations',
    details
  }),
  delete: (details: any) => auditLogger.logSuccess({
    action: 'location.delete',
    section: 'locations',
    details
  }),
  manageAccess: (details: any) => auditLogger.logSuccess({
    action: 'location.manage_access',
    section: 'locations',
    details
  })
};

/**
 * Log system actions
 */
export const logSystemAction = {
  maintenanceMode: (details: any) => auditLogger.logSuccess({
    action: 'system.maintenance_mode',
    section: 'system',
    details
  }),
  broadcast: (details: any) => auditLogger.logSuccess({
    action: 'system.broadcast',
    section: 'system',
    details
  }),
  exportData: (details: any) => auditLogger.logSuccess({
    action: 'system.export_data',
    section: 'system',
    details
  })
};

/**
 * Log content management actions
 */
export const logContentAction = {
  create: (details: any) => auditLogger.logSuccess({
    action: 'content.create',
    section: 'content',
    details
  }),
  update: (details: any) => auditLogger.logSuccess({
    action: 'content.update',
    section: 'content',
    details
  }),
  delete: (details: any) => auditLogger.logSuccess({
    action: 'content.delete',
    section: 'content',
    details
  }),
  publish: (details: any) => auditLogger.logSuccess({
    action: 'content.publish',
    section: 'content',
    details
  })
};