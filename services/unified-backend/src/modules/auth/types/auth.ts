export interface AuthTokenPayload {
  userId: string;
  username: string;
  email: string;
  userRoles?: ('user')[];
  iat: number;
  exp: number;
}

export interface CharacterContextPayload {
  characterId: string;
  characterName: string;
  userId: string;
  gameplayRoles: ('player' | 'master' | 'moderatore')[];
  playerStatus?: string;
  isApproved?: boolean;
  isGestore?: boolean;
  characterPermissions?: string[];
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

/**
 * Error details type for API responses
 */
export interface ErrorDetails {
  [key: string]: unknown;
  field?: string;
  expectedType?: string;
  receivedValue?: unknown;
  receivedType?: string;
  validationErrors?: Array<{ field: string; message: string; value?: unknown }>;
  affectedFields?: string[];
  duplicateField?: string;
  duplicateValue?: unknown;
  existingUserId?: string;
  providedId?: string;
  expectedFormat?: string;
  allowedFields?: string[];
  receivedFields?: string[];
  allowedValues?: string[];
  providedDuration?: string;
  invalidScopes?: string[];
  validScopes?: string[];
  availableScopes?: string[];
  searchedUserId?: string;
  requestedUserId?: string;
  searchPerformed?: boolean;
  errorType?: string;
  retryable?: boolean;
  operation?: string;
  userId?: string;
  mongoErrorCode?: number;
  indexName?: string;
}

/**
 * Pagination information for list responses
 */
export interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  // Additional common aliases (backend may use either naming convention)
  limit?: number;
  totalItems?: number;
  hasMore?: boolean;
}

/**
 * Standardized API Response interface
 */
export interface ApiResponse<T = any> {
  result: boolean;           // Standard: true/false
  success?: boolean;         // Optional: backward compat (mirrors result)
  data?: T;                  // Single record data or metadata object
  list?: T[];                // Array for list responses (alternative to data.list)
  pagination?: PaginationInfo; // Pagination info for list responses
  message?: string;          // Optional message for POST/PATCH/DELETE
  error?: string;            // Error message if result = false
  code?: string;             // Error code (e.g., 'USER_NOT_FOUND')
  details?: ErrorDetails;    // Additional error details (typed instead of any)
  timestamp: string;         // Always present
  requestId?: string;        // Optional for request tracing
}