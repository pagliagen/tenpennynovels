// =============================================================================
// API Utilities - Management Panel
// =============================================================================

import { apiRequest } from './auth';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// =============================================================================
// User Management API
// =============================================================================


export interface UpdateUserData {
  username?: string;
  email?: string;
  displayName?: string;
  canAccessAdminPanel?: boolean;
  userRoles?: string[];
  isActive?: boolean;
  multipleCharactersAllowed?: boolean;
}

export interface BanUserData {
  reason: string;
  duration: 'temporary' | 'permanent';
  banScopes: string[]; // Array of ban scopes: ['chat_banned', 'game_banned', etc.]
  bannedUntil?: string;
}

export const userAPI = {
  // Get all users with pagination
  getUsers: (params: PaginationParams = {}): Promise<ApiResponse<PaginatedResponse<any>>> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    return apiRequest(`/admin/users?${queryParams.toString()}`);
  },

  // Get single user by ID
  getUser: (userId: string): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/users/${userId}`);
  },


  // Update user
  updateUser: (userId: string, userData: UpdateUserData): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(userData),
    });
  },

  // Delete user
  deleteUser: (userId: string): Promise<ApiResponse<void>> => {
    return apiRequest(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },

  // Ban/unban user
  banUser: (userId: string, banned: boolean = true): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/users/${userId}/ban`, {
      method: 'POST',
      body: JSON.stringify({ banned }),
    });
  },

  // Update ban details
  updateBan: (userId: string, banData: BanUserData): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/users/${userId}/ban`, {
      method: 'PATCH',
      body: JSON.stringify(banData),
    });
  },

  // Unban user
  unbanUser: (userId: string, reason: string): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/users/${userId}/ban`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  },

  // Reset user password
  resetPassword: (userId: string, newPassword?: string): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  },


  // Update user permissions (simplified system: userRole and canAccessAdminPanel)
  updateUserPermissions: (userId: string, data: {
    userRole?: 'user' | 'gestore';
    canAccessAdminPanel?: boolean;
  }): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/users/${userId}/permissions`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Bulk actions
  bulkAction: (action: string, userIds: string[], data?: any): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/users/bulk', {
      method: 'POST',
      body: JSON.stringify({ action, userIds, data }),
    });
  },
};

// =============================================================================
// Character Management API
// =============================================================================

export interface ApproveCharacterData {
  notes?: string;
  gameplayRoles?: string[];
}

export interface RejectCharacterData {
  reason: string;
  notes?: string;
}

export const characterAPI = {
  // Get pending characters for approval
  getPendingCharacters: (params: PaginationParams = {}): Promise<ApiResponse<PaginatedResponse<any>>> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    return apiRequest(`/admin/characters/pending?${queryParams.toString()}`);
  },

  // Get all characters with pagination
  getCharacters: (params: PaginationParams = {}): Promise<ApiResponse<PaginatedResponse<any>>> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    return apiRequest(`/admin/characters?${queryParams.toString()}`);
  },

  // Get single character by ID
  getCharacter: (characterId: string): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/characters/${characterId}`);
  },

  // Approve character
  approveCharacter: (characterId: string, data: ApproveCharacterData = {}): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/characters/${characterId}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Reject character
  rejectCharacter: (characterId: string, data: RejectCharacterData): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/characters/${characterId}/reject`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Submit character review (approve/reject) - uses existing CharacterApprovalController
  submitCharacterReview: (characterId: string, data: { action: 'approve' | 'reject'; note: string }): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/characters/${characterId}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get characters pending approval (filtered by status)
  getCharactersPendingApproval: (params: PaginationParams = {}): Promise<ApiResponse<PaginatedResponse<any>>> => {
    const queryParams = new URLSearchParams();
    // Add status filter for PENDING_APPROVAL
    queryParams.append('status', 'PENDING_APPROVAL');
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    return apiRequest(`/admin/characters?${queryParams.toString()}`);
  },

  // Update character
  updateCharacter: (characterId: string, data: any): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/characters/${characterId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Delete character
  deleteCharacter: (characterId: string): Promise<ApiResponse<void>> => {
    return apiRequest(`/admin/characters/${characterId}`, {
      method: 'DELETE',
    });
  },

  // Bulk approve/reject
  bulkAction: (action: 'approve' | 'reject', characterIds: string[], data?: any): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/characters/bulk', {
      method: 'POST',
      body: JSON.stringify({ action, characterIds, data }),
    });
  },
};

// =============================================================================
// Content Management API
// =============================================================================

export const contentAPI = {
  // Documents
  getDocuments: (params: PaginationParams = {}): Promise<ApiResponse<PaginatedResponse<any>>> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    return apiRequest(`/admin/documents?${queryParams.toString()}`);
  },

  createDocument: (data: any): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateDocument: (documentId: string, data: any): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/documents/${documentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteDocument: (documentId: string): Promise<ApiResponse<void>> => {
    return apiRequest(`/admin/documents/${documentId}`, {
      method: 'DELETE',
    });
  },

  // Forum posts
  getForumPosts: (params: PaginationParams = {}): Promise<ApiResponse<PaginatedResponse<any>>> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    return apiRequest(`/admin/forum/posts?${queryParams.toString()}`);
  },

  moderatePost: (postId: string, action: 'approve' | 'reject' | 'hide', reason?: string): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/forum/posts/${postId}/moderate`, {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    });
  },
};

// =============================================================================
// Economy Management API
// =============================================================================

export interface TransactionData {
  fromUserId?: string;
  toUserId: string;
  amount: number;
  type: 'grant' | 'deduct' | 'transfer';
  reason: string;
  notes?: string;
}

export const economyAPI = {
  // Get economy overview
  getEconomyOverview: (): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/economy/overview');
  },

  // Get transactions
  getTransactions: (params: PaginationParams = {}): Promise<ApiResponse<PaginatedResponse<any>>> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    return apiRequest(`/admin/economy/transactions?${queryParams.toString()}`);
  },

  // Create transaction
  createTransaction: (data: TransactionData): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/economy/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get character balances
  getCharacterBalances: (params: PaginationParams = {}): Promise<ApiResponse<PaginatedResponse<any>>> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    return apiRequest(`/admin/economy/balances?${queryParams.toString()}`);
  },

  // Update character balance
  updateBalance: (characterId: string, amount: number, reason: string): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/economy/balances/${characterId}`, {
      method: 'PATCH',
      body: JSON.stringify({ amount, reason }),
    });
  },
};

// =============================================================================
// System Management API
// =============================================================================

export const systemAPI = {
  // Get system metrics
  getMetrics: (): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/system/metrics');
  },

  // Get system logs
  getLogs: (params: { level?: string; service?: string; limit?: number }): Promise<ApiResponse<any>> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    return apiRequest(`/admin/system/logs?${queryParams.toString()}`);
  },

  // Get active sessions
  getActiveSessions: (): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/system/sessions');
  },

  // Get Redis stats
  getRedisStats: (): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/system/redis');
  },

  // Get database stats
  getDatabaseStats: (): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/system/database');
  },

  // Clear cache
  clearCache: (cacheType?: string): Promise<ApiResponse<void>> => {
    return apiRequest('/admin/system/cache', {
      method: 'DELETE',
      body: JSON.stringify({ cacheType }),
    });
  },

  // Send system notification
  sendNotification: (data: {
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    targetRoles: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/system/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// =============================================================================
// Dashboard API
// =============================================================================

export const dashboardAPI = {
  // Get dashboard statistics
  getStats: (): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/dashboard/stats');
  },

  // Get recent activity
  getRecentActivity: (limit: number = 10): Promise<ApiResponse<any[]>> => {
    return apiRequest(`/admin/dashboard/activity?limit=${limit}`);
  },

  // Get pending approvals count
  getPendingApprovals: (): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/dashboard/pending');
  },

  // Get system health
  getSystemHealth: (): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/dashboard/health');
  },
};

// =============================================================================
// Utility Functions
// =============================================================================

export function buildQueryParams(params: Record<string, any>): string {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => queryParams.append(key, v.toString()));
      } else {
        queryParams.append(key, value.toString());
      }
    }
  });
  return queryParams.toString();
}

export function handleApiError(error: any, fallbackMessage: string = 'An error occurred'): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  return fallbackMessage;
}