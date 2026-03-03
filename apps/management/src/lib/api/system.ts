/**
 * System API Client
 *
 * API methods for system configuration, maintenance, broadcasts, and audit logs.
 * Used by /system/* pages in management panel.
 *
 * @module lib/api/system
 */

import { api } from './client';

export interface SystemConfig {
  gameSettings: {
    newCharacterApprovalRequired: boolean;
    maxCharactersPerUser: number;
    characterCreationEnabled: boolean;
    aiCharacterGenerationEnabled: boolean;
  };
  economySettings: {
    startingCash: number;
    startingDeposit: number;
    dailySalaryEnabled: boolean;
  };
  moderationSettings: {
    chatModerationEnabled: boolean;
    autoModerationLevel: 'low' | 'medium' | 'high';
  };
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: {
    userId: string;
    username: string;
    characterName?: string;
    userRoles: string[];
    characterRoles: string[];
  };
  action: string;
  actionDescription: string;
  category: string;
  target?: {
    type: string;
    id: string;
    name: string;
  };
  success: boolean;
  errorMessage?: string;
  details?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  duration?: number;
}

export interface AuditLogParams {
  page?: number;
  pageSize?: number;
  category?: string;
  adminUserId?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  success?: boolean;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface MaintenanceStatus {
  enabled: boolean;
  message?: string;
  enabledAt?: string;
  enabledBy?: {
    _id: string;
    username: string;
  };
}

export interface AuditLogResponse {
  items: AuditLog[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * System API methods
 */
export const systemAPI = {
  /**
   * Get system configuration
   * GET /admin/system/config
   */
  getConfig: async (): Promise<SystemConfig> => {
    const response = await api.get('/admin/system/config');
    return response.data as SystemConfig;
  },

  /**
   * Update system configuration
   * PATCH /admin/system/config
   */
  updateConfig: async (updates: Partial<SystemConfig>): Promise<SystemConfig> => {
    const response = await api.patch('/admin/system/config', updates);
    return response.data as SystemConfig;
  },

  /**
   * Get audit logs with pagination and filtering
   * GET /admin/system/audit-logs
   */
  getAuditLogs: async (params: AuditLogParams): Promise<AuditLogResponse> => {
    const response = await api.get('/admin/system/audit-logs', { params });
    return response.data as AuditLogResponse;
  },

  /**
   * Send broadcast message to all users
   * POST /admin/system/broadcast
   */
  sendBroadcast: async (message: string): Promise<{ sent: number }> => {
    const response = await api.post('/admin/system/broadcast', { message });
    return response.data as { sent: number };
  },

  /**
   * Get maintenance mode status
   * GET /admin/system/maintenance
   */
  getMaintenanceStatus: async (): Promise<MaintenanceStatus> => {
    const response = await api.get('/admin/system/maintenance');
    return response.data as MaintenanceStatus;
  },

  /**
   * Set maintenance mode (enable/disable)
   * POST /admin/system/maintenance
   */
  setMaintenanceMode: async (enabled: boolean, message?: string): Promise<MaintenanceStatus> => {
    const response = await api.post('/admin/system/maintenance', { enabled, message });
    return response.data as MaintenanceStatus;
  }
};
