// Security middleware and validation for admin access
export interface SecurityValidation {
  // Cookie validation
  validateAuthCookie(cookieValue: string): {
    isValid: boolean;
    userId?: string;
    username?: string;
    role?: string;
    expiresAt?: Date;
    error?: string;
  };
  
  validateCharacterContextCookie(cookieValue: string): {
    isValid: boolean;
    userId?: string;
    characterId?: string;
    characterName?: string;
    expiresAt?: Date;
    error?: string;
  };
  
  // Admin access validation
  validateAdminAccess(authCookie: string): {
    hasAccess: boolean;
    userRoles: string[];
    characterRoles: string[];
    characterPermissions: string[];
    error?: string;
  };
  
  // Dual token validation (for game access)
  validateDualTokenAccess(authCookie: string, characterCookie: string): {
    isValid: boolean;
    userId: string;
    characterId: string;
    error?: string;
  };
}

// Frontend route guards configuration
export interface RouteGuardConfig {
  // Route patterns and their required access levels
  routes: {
    // Public routes (no authentication)
    public: string[]; // ["/", "/documents/public/*", "/forum/public/*"]
    
    // Requires valid auth cookie
    authenticated: string[]; // ["/documents/private/*", "/forum/private/*"]
    
    // Requires both auth + character context cookies
    game: string[]; // ["/game/*"]
    
    // Requires admin role in auth cookie
    admin: string[]; // ["/management/*"]
  };
  
  // Redirect paths for unauthorized access
  redirects: {
    unauthenticated: string; // "/login"
    insufficientRole: string; // "/unauthorized"
    missingCharacterContext: string; // "/character-select"
  };
}

// API endpoint protection configuration
export interface APIProtectionConfig {
  endpoints: {
    // Public endpoints (no authentication required)
    public: {
      paths: string[];
      methods: string[];
    };
    
    // Requires valid auth cookie
    authenticated: {
      paths: string[]; // ["/api/characters", "/api/locations"]
      methods: string[];
    };
    
    // Requires both cookies (game functionality)
    dualAuth: {
      paths: string[]; // ["/api/game/*", "/api/chat/*"]
      methods: string[];
    };
    
    // Admin-only endpoints
    adminOnly: {
      paths: string[]; // ["/admin/*", "/api/management/*"]
      methods: string[];
      requiredPermissions?: { [path: string]: string[] };
    };
  };
  
  // Security headers
  securityHeaders: {
    enableCSRF: boolean;
    corsOrigins: string[];
    rateLimiting: {
      windowMs: number;
      maxRequests: number;
      skipAdminUsers: boolean;
    };
  };
}

// Cookie configuration for different environments
export interface CookieConfig {
  authCookie: {
    name: string; // "auth_token"
    httpOnly: boolean;
    secure: boolean; // true in production
    sameSite: 'strict' | 'lax' | 'none';
    maxAge: number; // seconds
    domain?: string;
    path: string;
  };
  
  characterContextCookie: {
    name: string; // "character_context"
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    maxAge: number;
    domain?: string;
    path: string;
  };
}

// Admin permission definitions
export const ADMIN_PERMISSIONS = {
  // User Management
  USER_VIEW: 'user:view',
  USER_CREATE: 'user:create',
  USER_EDIT: 'user:edit',
  USER_DELETE: 'user:delete',
  USER_BAN: 'user:ban',
  
  // Character Management  
  CHARACTER_VIEW: 'character:view',
  CHARACTER_APPROVE: 'character:approve',
  CHARACTER_REJECT: 'character:reject',
  CHARACTER_EDIT: 'character:edit',
  CHARACTER_DELETE: 'character:delete',
  
  // Content Management
  CONTENT_CREATE: 'content:create',
  CONTENT_EDIT: 'content:edit',
  CONTENT_DELETE: 'content:delete',
  CONTENT_PUBLISH: 'content:publish',
  
  // Location Management
  LOCATION_CREATE: 'location:create',
  LOCATION_EDIT: 'location:edit',
  LOCATION_DELETE: 'location:delete',
  
  // Corporation Management
  CORPORATION_CREATE: 'corporation:create',
  CORPORATION_EDIT: 'corporation:edit',
  CORPORATION_DELETE: 'corporation:delete',
  CORPORATION_FINANCE: 'corporation:finance',
  
  // System Administration
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_LOGS: 'system:logs',
  SYSTEM_BACKUP: 'system:backup',
  
  // Moderation
  MODERATION_CHAT: 'moderation:chat',
  MODERATION_FORUM: 'moderation:forum',
  MODERATION_REPORTS: 'moderation:reports',
  
  // Financial Management
  FINANCE_VIEW: 'finance:view',
  FINANCE_EDIT: 'finance:edit',
  FINANCE_GRANT: 'finance:grant',
} as const;

// Security audit logging
export interface SecurityAuditLog {
  id: string;
  
  // Event details
  eventType: 'login' | 'logout' | 'failed_login' | 'admin_access' | 
            'unauthorized_access' | 'token_validation' | 'permission_denied';
  
  // User context
  userId?: string;
  username?: string;
  userRole?: string;
  ipAddress: string;
  userAgent: string;
  
  // Request context
  requestPath: string;
  requestMethod: string;
  
  // Security context
  cookiesPresent: {
    authCookie: boolean;
    characterContextCookie: boolean;
  };
  
  // Result
  success: boolean;
  errorMessage?: string;
  actionTaken?: string; // What action was taken (redirect, block, etc.)
  
  // Metadata
  timestamp: Date;
  sessionId?: string;
}

// Rate limiting configuration
export interface RateLimitConfig {
  // General API rate limiting
  general: {
    windowMs: number; // 15 minutes
    maxRequests: number; // 100 requests per window
  };
  
  // Authentication endpoints (stricter)
  auth: {
    windowMs: number; // 15 minutes
    maxRequests: number; // 10 requests per window
  };
  
  // Admin endpoints (more lenient for admins)
  admin: {
    windowMs: number; // 15 minutes
    maxRequests: number; // 500 requests per window
  };
  
  // Game endpoints (frequent updates needed)
  game: {
    windowMs: number; // 1 minute
    maxRequests: number; // 60 requests per window
  };
}

// Frontend security utilities
export interface FrontendSecurity {
  // Check if user has required role for current route
  checkRouteAccess(currentPath: string, userRole?: string): {
    hasAccess: boolean;
    redirectTo?: string;
    reason?: string;
  };
  
  // Validate cookies before making API calls
  validateCookiesForAPI(endpoint: string): {
    isValid: boolean;
    missingCookies: string[];
    shouldRedirect?: string;
  };
  
  // Get user context from cookies
  getUserContextFromCookies(): {
    isAuthenticated: boolean;
    userId?: string;
    username?: string;
    role?: string;
    activeCharacterId?: string;
    characterName?: string;
  };
}

export type AdminPermission = typeof ADMIN_PERMISSIONS[keyof typeof ADMIN_PERMISSIONS];