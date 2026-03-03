/**
 * User API Types
 *
 * Definisce interfacce per User entity e relative API responses.
 */

export interface User {
  _id: string;
  username: string;
  email: string;
  displayName: string;
  canAccessAdminPanel: boolean;
  userRoles: string[];
  characterRoles: string[];
  characterPermissions: string[];
  accountStatus: {
    isActive: boolean;
    isEmailVerified: boolean;
    isBanned: boolean;
    banReason?: string;
    bannedAt?: string;
    bannedBy?: string; // Admin user ID who performed the ban
    bannedByName?: string; // Character name of admin who performed the ban
  };
  multipleCharactersAllowed: boolean;
  characters: UserCharacter[];
  activity: {
    lastLoginAt: string | null;
    loginCount: number;
    messagesSent: number;
    documentsCreated: number;
    moderationActions: number;
  };
  registrationInfo: {
    registeredAt: string;
    registrationSource: string;
    ipAddress: string;
    referrer?: string;
  };
}

export interface UserCharacter {
  _id: string;
  name: string;
  status: 'active' | 'inactive' | 'pending' | 'rejected';
  createdAt: string;
}

export interface UserListParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  status?: 'active' | 'inactive' | 'banned';
  role?: string;
}

export interface UserListResponse {
  items: User[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface UpdateUserData {
  displayName?: string;
  email?: string;
  canAccessAdminPanel?: boolean;
  userRoles?: string[];
  characterRoles?: string[];
  characterPermissions?: string[];
  accountStatus?: {
    isActive?: boolean;
    isEmailVerified?: boolean;
    isBanned?: boolean;
    banReason?: string;
  };
  multipleCharactersAllowed?: boolean;
}

export interface BanUserData {
  reason: string;
  duration?: number; // Durata in giorni, undefined = permanente
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
