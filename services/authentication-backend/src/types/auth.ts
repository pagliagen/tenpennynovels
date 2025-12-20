export interface AuthTokenPayload {
  userId: string;
  username: string;
  email: string;
  canAccessAdminPanel: boolean;
  // New granular permission system
  userRoles?: ('user' | 'gestore')[];
  characterRoles?: ('personaggio' | 'master' | 'moderatore' | 'amministratore')[];
  characterPermissions?: string[];
  // No more legacy fields - using only granular system
  iat: number;
  exp: number;
}

export interface CharacterContextPayload {
  characterId: string;
  characterName: string;
  userId: string;
  gameplayRoles: ('personaggio' | 'master' | 'moderatore' | 'gestore')[];
  iat: number;
  exp: number;
}

export interface SessionData {
  userId: string;
  username: string;
  sessionId: string;
  deviceInfo?: DeviceInfo;
  ipAddress: string;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
}

export interface DeviceInfo {
  deviceName?: string;
  browser?: string;
  os?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  userAgent?: string;
}

export interface LocationInfo {
  ipAddress: string;
  country?: string;
  city?: string;
  region?: string;
  timezone?: string;
}

export interface LoginAttempt {
  identifier: string; // username or email
  ipAddress: string;
  timestamp: Date;
  success: boolean;
  reason?: string;
  deviceInfo?: DeviceInfo;
  locationInfo?: LocationInfo;
}

export interface SecurityAlert {
  id: string;
  userId: string;
  type: 'new_device_login' | 'failed_login_attempts' | 'suspicious_activity' | 'account_locked';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  message: string;
  details: any;
  action?: string;
  acknowledged: boolean;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: any) => string;
}

// TODO: Import from shared package when workspace configuration is complete
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
  details?: any;
  timestamp: string;  // Required field
  requestId?: string;
}