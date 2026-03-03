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
  _id: string;
  timestamp: string;
  adminUser: {
    _id: string;
    username: string;
  };
  action: string;
  category: string;
  target: {
    type: string;
    id: string;
    name: string;
  };
  severity: 'info' | 'warning' | 'critical';
  details?: Record<string, unknown>;
}

export interface AuditLogParams {
  page?: number;
  pageSize?: number;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  severity?: 'info' | 'warning' | 'critical';
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
    return response.data;
  },

  /**
   * Update system configuration
   * PATCH /admin/system/config
   */
  updateConfig: async (updates: Partial<SystemConfig>): Promise<SystemConfig> => {
    const response = await api.patch('/admin/system/config', updates);
    return response.data;
  },

  /**
   * Get audit logs with pagination and filtering
   * GET /admin/system/audit-logs
   */
  getAuditLogs: async (params: AuditLogParams) => {
    const response = await api.get('/admin/system/audit-logs', { params });
    return response.data;
  },

  /**
   * Send broadcast message to all users
   * POST /admin/system/broadcast
   */
  sendBroadcast: async (message: string): Promise<{ sent: number }> => {
    const response = await api.post('/admin/system/broadcast', { message });
    return response.data;
  },

  /**
   * Get maintenance mode status
   * GET /admin/system/maintenance
   */
  getMaintenanceStatus: async (): Promise<MaintenanceStatus> => {
    const response = await api.get('/admin/system/maintenance');
    return response.data;
  },

  /**
   * Set maintenance mode (enable/disable)
   * POST /admin/system/maintenance
   */
  setMaintenanceMode: async (enabled: boolean, message?: string): Promise<MaintenanceStatus> => {
    const response = await api.post('/admin/system/maintenance', { enabled, message });
    return response.data;
  }
};
