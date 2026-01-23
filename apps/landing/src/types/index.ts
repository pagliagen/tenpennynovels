// Landing App Types
// Local types extracted from shared-types for production build compatibility

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  displayName?: string;
  agreeToTerms: boolean;
  subscribeNewsletter?: boolean;
  referralCode?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  isEmailVerified: boolean;
  canAccessAdminPanel: boolean;
  userRoles?: ('user' | 'gestore')[];
  characterRoles?: ('personaggio' | 'master' | 'moderatore' | 'amministratore')[];
  characterPermissions?: string[];
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface Character {
  id: string;
  name: string;
  userId: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'DELETED';
  occupation: string;
  socialClass: 'working' | 'middle' | 'upper';
  gender: 'male' | 'female';
  age: number;
  currentLocationId: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  rejectedReason?: string;
  lastActiveAt?: Date;
}

export interface ApiResponse<T = any> {
  result: boolean;
  data?: T;
  list?: T[];
  error?: string;
  code?: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface FormErrors {
  [field: string]: string | undefined;
}