// =============================================================================
// API Utilities - Management Panel
// =============================================================================

import { apiRequest } from './auth';

// Re-export apiRequest for convenience
export { apiRequest };

export interface ApiResponse<T = any> {
  result: boolean;           // Standard: true/false
  data?: T;                  // Single record data or metadata object
  list?: T[];                // Array for list responses
  pagination?: PaginationInfo; // Pagination info for list responses
  message?: string;          // Optional message for POST/PATCH/DELETE
  error?: string;            // Error message if result = false
  code?: string;             // Error code (e.g., 'USER_NOT_FOUND')
  details?: Record<string, any>; // Additional error details
  timestamp?: string;        // Always present
  requestId?: string;        // Optional for request tracing
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  // Additional common aliases (backend may use either naming convention)
  currentPage: number;
  limit: number;
  totalItems: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationInfo;
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

  updateDocumentContent: (documentId: string, content: string, css?: string): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/documents/${documentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content, css }),
    });
  },

  updateGlobalCSS: (cssClasses: Array<{id: string, title: string, css: string, htmlElement: string, isPredefined?: boolean}>): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/documents/css`, {
      method: 'PUT',
      body: JSON.stringify({ cssClasses }),
    });
  },

  getGlobalCSS: (): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/documents/css`);
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
// Corporation Management API
// =============================================================================

export interface Corporation {
  id: string;
  name: string;
  description: string;
  type: string;
  status: 'active' | 'inactive' | 'disbanded';
  ownerId: string;
  ownerName: string;
  memberCount: number;
  officerCount: number;
  treasury: number;
  createdAt: string;
}

export interface CorporationDetails extends Omit<Corporation, 'treasury'> {
  ownerUserId: string;
  ownerUsername: string;
  ownerEmail: string;
  officers: Array<{
    characterId: string;
    characterName: string;
    userId: string;
    username: string;
    email: string;
    role: string;
    appointedAt: string | null;
    gameplayRoles: string[];
  }>;
  members: Array<{
    characterId: string;
    characterName: string;
    userId: string;
    username: string;
    email: string;
    gameplayRoles: string[];
  }>;
  treasury: {
    cash: number;
    bankDeposit: number;
    totalValue: number;
    lastUpdated: string | null;
  };
  membershipRequirements: any;
  rules: string[];
  updatedAt: string | null;
  lastActivity: string | null;
  activityLog: Array<{
    action: string;
    performedBy: string | null;
    performedByName: string;
    timestamp: string | null;
    details: string;
  }>;
}

export interface CorporationStats {
  period: string;
  overview: {
    totalCorporations: number;
    activeCorporations: number;
    inactiveCorporations: number;
    disbandedCorporations: number;
    pendingRequests: number;
    totalMembers: number;
    recentCorporations: number;
  };
  corporationsByType: Array<{ type: string; count: number }>;
  topCorporations: Array<{ id: string; name: string; type: string; memberCount: number }>;
}

export interface MembershipRequest {
  id: string;
  corporationId: string;
  corporationName: string;
  corporationType: string;
  characterId: string;
  characterName: string;
  userId: string;
  username: string;
  email: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface CreateCorporationData {
  name: string;
  description: string;
  type: 'guild' | 'professional_association' | 'social_club' | 'government_body' | 'criminal_organization';
  membershipType: 'manual' | 'automatic' | 'mixed';
  isRecruiting: boolean;
  maxMembers?: number;
}

export interface UpdateCorporationData {
  name?: string;
  description?: string;
  status?: 'active' | 'inactive' | 'disbanded';
  isRecruiting?: boolean;
  maxMembers?: number;
  reason?: string;
}

export interface TreasuryOperationData {
  action: 'add' | 'remove';
  amount: number;
  reason: string;
}

export const corporationAPI = {
  // Get all corporations with pagination and filtering
  getCorporations: (params: PaginationParams & {
    status?: string;
    type?: string;
  } = {}): Promise<ApiResponse<{ corporations: Corporation[]; pagination: PaginationInfo }>> => {
    const queryParams = buildQueryParams(params);
    return apiRequest(`/admin/corporations?${queryParams}`);
  },

  // Get corporation statistics
  getStats: (period: string = 'month'): Promise<ApiResponse<CorporationStats>> => {
    return apiRequest(`/admin/corporations/stats?period=${period}`);
  },

  // Get single corporation details
  getCorporation: (corporationId: string): Promise<ApiResponse<{ corporation: CorporationDetails }>> => {
    return apiRequest(`/admin/corporations/${corporationId}`);
  },

  // Create new corporation
  createCorporation: (data: CreateCorporationData): Promise<ApiResponse<{ corporationId: string }>> => {
    return apiRequest('/admin/corporations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update corporation
  updateCorporation: (corporationId: string, data: UpdateCorporationData): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/corporations/${corporationId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete corporation (soft delete)
  deleteCorporation: (corporationId: string, reason: string): Promise<ApiResponse<void>> => {
    return apiRequest(`/admin/corporations/${corporationId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  },

  // Get membership requests for a corporation
  getMembershipRequests: (corporationId: string, params: PaginationParams = {}): Promise<ApiResponse<{ requests: MembershipRequest[]; pagination: PaginationInfo }>> => {
    const queryParams = buildQueryParams(params);
    return apiRequest(`/admin/corporations/${corporationId}/membership-requests?${queryParams}`);
  },

  // Handle membership request (approve/reject)
  handleMembershipRequest: (corporationId: string, requestId: string, data: {
    action: 'approve' | 'reject';
    note: string;
    role?: string;
  }): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/corporations/${corporationId}/membership-requests/${requestId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Manage corporation treasury
  manageTreasury: (corporationId: string, data: TreasuryOperationData): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/corporations/${corporationId}/treasury`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Bulk operations on corporations
  bulkOperations: (data: {
    operation: string;
    corporationIds: string[];
    amount?: number;
    reason?: string;
  }): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/corporations/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get all membership requests across all corporations (for membership-requests page)
  getAllMembershipRequests: (params: PaginationParams & {
    corporationId?: string;
  } = {}): Promise<ApiResponse<{ requests: MembershipRequest[]; pagination: PaginationInfo }>> => {
    // Note: This endpoint needs to be implemented in the backend
    const queryParams = buildQueryParams(params);
    return apiRequest(`/admin/corporations/membership-requests?${queryParams}`);
  },
};

// =============================================================================
// Location Management API
// =============================================================================

export interface LocationData {
  id: string;
  name: string;
  slug: string;
  description: string;
  district: string;
  parentLocation?: string;
  parentLocationName?: string;
  imageUrl?: string;
  settings: {
    visible: boolean;
    chat: boolean;
    shop: boolean;
    private: boolean;
  };
  locationLevel: 'root' | 'district' | 'location';
  sortOrder: number;
  statistics?: {
    totalVisits: number;
    uniqueVisitors: number;
    currentOccupants: number;
    averageStayTime: string;
    messagesExchanged: number;
  };
  management?: {
    createdBy: string;
    lastModified: string;
    modifiedBy: string;
  };
}

export interface LocationHierarchy {
  id: string;
  name: string;
  level: string;
  children?: LocationHierarchy[];
}

export const locationAPI = {
  // Get all locations with pagination
  getLocations: (params: PaginationParams & { district?: string; showHidden?: boolean } = {}): Promise<ApiResponse<{ locations: LocationData[]; pagination: PaginationInfo }>> => {
    const queryString = buildQueryParams(params);
    return apiRequest(`/admin/locations?${queryString}`);
  },

  // Get location hierarchy
  getHierarchy: (): Promise<ApiResponse<LocationHierarchy[]>> => {
    return apiRequest('/admin/locations/hierarchy');
  },

  // Get location statistics
  getStats: (): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/locations/stats');
  },

  // Get single location
  getLocation: (locationId: string): Promise<ApiResponse<LocationData>> => {
    return apiRequest(`/admin/locations/${locationId}`);
  },

  // Create new location
  createLocation: (locationData: Partial<LocationData>): Promise<ApiResponse<LocationData>> => {
    return apiRequest('/admin/locations', {
      method: 'POST',
      body: JSON.stringify(locationData),
    });
  },

  // Update location
  updateLocation: (locationId: string, locationData: Partial<LocationData>): Promise<ApiResponse<LocationData>> => {
    return apiRequest(`/admin/locations/${locationId}`, {
      method: 'PUT',
      body: JSON.stringify(locationData),
    });
  },

  // Delete location
  deleteLocation: (locationId: string): Promise<ApiResponse<void>> => {
    return apiRequest(`/admin/locations/${locationId}`, {
      method: 'DELETE',
    });
  },

  // Manage location access
  manageAccess: (locationId: string, accessData: any): Promise<ApiResponse<void>> => {
    return apiRequest(`/admin/locations/${locationId}/access`, {
      method: 'PUT',
      body: JSON.stringify(accessData),
    });
  },

  // Bulk operations
  bulkOperation: (operation: string, locationIds: string[], data?: any): Promise<ApiResponse<void>> => {
    return apiRequest('/admin/locations/bulk', {
      method: 'POST',
      body: JSON.stringify({ operation, locationIds, data }),
    });
  },
};

// =============================================================================
// Housing Property Management API
// =============================================================================

export interface HousingPropertyData {
  id?: string;
  locationId: string;
  propertyType: 'basic_room' | 'furnished_room' | 'luxury_suite' | 'small_house' | 'large_house' | 'mansion';
  district: string;
  address?: string;
  ownershipType: 'rental' | 'owned' | 'available';
  currentTenantId?: string;
  ownerId?: string;
  monthlyRent?: number;
  purchasePrice?: number;
  monthlyMaintenance: number;
  deposit?: number;
  isAvailable: boolean;
  condition: 'poor' | 'fair' | 'good' | 'excellent';
  features?: {
    furnished: boolean;
    hasKitchen: boolean;
    hasPrivateBathroom: boolean;
    hasGarden: boolean;
    hasBalcony: boolean;
    fireplace: boolean;
    gaslighting: boolean;
    waterSupply: 'none' | 'shared' | 'private';
    roomCount: number;
  };
  socialClassRestriction?: ('working' | 'middle' | 'upper')[];
  minimumIncome?: number;
}

export const housingPropertyAPI = {
  // Get all properties with pagination
  getHousingProperties: (params: PaginationParams & { 
    district?: string; 
    propertyType?: string;
    ownershipType?: string;
    isAvailable?: boolean;
  } = {}): Promise<ApiResponse<PaginatedResponse<any>>> => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    return apiRequest(`/admin/housing/properties?${queryParams.toString()}`);
  },

  // Get single property by ID
  getHousingProperty: (propertyId: string): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/housing/properties/${propertyId}`);
  },

  // Create new property
  createHousingProperty: (propertyData: Partial<HousingPropertyData>): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/housing/properties', {
      method: 'POST',
      body: JSON.stringify(propertyData),
    });
  },

  // Update property
  updateHousingProperty: (propertyId: string, propertyData: Partial<HousingPropertyData>): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/housing/properties/${propertyId}`, {
      method: 'PUT',
      body: JSON.stringify(propertyData),
    });
  },

  // Delete property
  deleteHousingProperty: (propertyId: string): Promise<ApiResponse<void>> => {
    return apiRequest(`/admin/housing/properties/${propertyId}`, {
      method: 'DELETE',
    });
  },

  // Get districts
  getDistricts: (): Promise<ApiResponse<string[]>> => {
    return apiRequest('/admin/housing/districts');
  },

  // Get housing statistics
  getHousingStats: (): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/housing/stats');
  },

  // Get housing reports
  getHousingReports: (params?: Record<string, any>): Promise<ApiResponse<any>> => {
    const queryString = buildQueryParams(params || {});
    return apiRequest(`/admin/housing/reports?${queryString}`);
  },

  // Trigger rent collection
  triggerRentCollection: (): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/housing/rent-collection', {
      method: 'POST',
    });
  },

  // Adjust rents (bulk operation)
  adjustRents: (adjustments: Array<{ propertyId: string; newRent: number }>): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/housing/rent-adjustments', {
      method: 'PUT',
      body: JSON.stringify({ adjustments }),
    });
  },

  // Process evictions
  processEvictions: (evictionData: any): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/housing/evictions', {
      method: 'POST',
      body: JSON.stringify(evictionData),
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