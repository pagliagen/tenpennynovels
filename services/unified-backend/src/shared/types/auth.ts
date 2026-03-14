/**
 * Type aliases for compatibility with modules expecting old names
 * (Defined after interfaces below)
 */

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;

  userRoles: ('user')[];

  // Profile
  displayName?: string;
  avatar?: string;

  // Account status
  isActive: boolean;
  isEmailVerified: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface AuthToken {
  userId: string;
  username: string;
  email: string;
  userRoles?: ('user')[];
  iat: number;
  exp: number;
}

/**
 * Request user: AuthToken plus optional fields set by admin middleware from selected character.
 * characterRoles = admin role names (personaggio, master, moderatore, amministratore) for permission checks.
 */
export interface RequestUser extends AuthToken {
  characterRoles?: string[];
  canAccessAdminPanel?: boolean;
  gameplayRoles?: ('player' | 'master' | 'moderatore')[];
  adminPermissions?: string[];
  isGestore?: boolean;
}

// Alias for backward compatibility
export type AuthTokenPayload = AuthToken;

export interface CharacterContextToken {
  userId: string;
  characterId: string;
  characterName: string;
  avatar?: string;
  isApproved?: boolean;
  gameplayRoles?: ('player' | 'master' | 'moderatore')[];
  playerStatus?: string; // draft, pending, approved
  isGestore?: boolean;
  characterPermissions?: string[];
  sessionId?: string;
  iat: number;
  exp: number;
}

// Alias for backward compatibility
export type CharacterContextPayload = CharacterContextToken;

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  authToken?: string;
  user?: {
    id: string;
    username: string;
    canAccessAdminPanel: boolean;
    userRoles?: string[];
    characters: {
      id: string;
      name: string;
      status: string;
    }[];
  };
  error?: string;
}

export interface CharacterSelectRequest {
  characterId: string;
}

export interface CharacterSelectResponse {
  success: boolean;
  characterContextToken?: string;
  character?: {
    id: string;
    name: string;
    status: string;
    currentLocation: string;
  };
  error?: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  userId?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
}

export interface TokenValidation {
  isValid: boolean;
  decoded?: AuthToken | CharacterContextToken;
  error?: string;
}

export interface AdminAccessCheck {
  hasAccess: boolean;
  canAccessAdminPanel: boolean;
  userRoles?: string[];
  characterRoles?: string[];
  requiredPermissions?: string[];
  missingPermissions?: string[];
  reason?: string;
}

// Middleware for granular access control
export interface AdminAuthMiddleware {
  // Check if user can access admin panel
  requireAdminAccess(req: any, res: any, next: any): void;
  
  // Check if user has specific granular permissions
  requirePermissions(permissions: string[]): (req: any, res: any, next: any) => void;
  
  // Validate both auth and character context tokens
  requireCharacterAuth(req: any, res: any, next: any): void;
  
  // Extract user info from tokens
  extractUserContext(req: any): {
    userId: string;
    username: string;
    canAccessAdminPanel: boolean;
    userRoles: string[];
    characterRoles: string[];
    characterPermissions: string[];
    activeCharacterId?: string;
  } | null;
}

// API Security headers and settings
export interface APISecurityConfig {
  // CORS settings for different environments
  corsOrigins: {
    landing: string;
    game: string;
    documents: string;
    forum: string;
    management: string;
  };
  
  // Token validation settings
  tokenSettings: {
    authTokenExpiry: number; // seconds
    characterContextExpiry: number; // seconds
    refreshTokenExpiry: number; // seconds
  };
  
  // Rate limiting
  rateLimiting: {
    general: { requests: number; windowMs: number };
    admin: { requests: number; windowMs: number };
    auth: { requests: number; windowMs: number };
  };
}

// Frontend route protection
export interface RouteProtection {
  // Public routes (no authentication required)
  publicRoutes: string[];
  
  // Routes requiring authentication
  authenticatedRoutes: string[];
  
  // Routes requiring both auth and character context
  gameRoutes: string[];
  
  // Routes requiring admin role
  adminRoutes: string[];
  
  // Routes requiring specific granular permissions
  permissionRoutes: {
    route: string;
    requiredPermissions: string[];
  }[];
}