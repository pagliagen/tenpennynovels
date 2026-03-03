/**
 * Type aliases for compatibility with modules expecting old names
 * (Defined after interfaces below)
 */

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  
  // Admin panel access gate
  canAccessAdminPanel: boolean;
  
  // New granular permission system
  userRoles: ('user' | 'gestore')[];
  characterRoles: ('personaggio' | 'master' | 'moderatore' | 'amministratore')[];
  characterPermissions: string[];
  
  // No more legacy fields - using only granular system
  
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
  canAccessAdminPanel: boolean;

  // New granular permission system
  userRoles?: ('user' | 'gestore')[];
  characterRoles?: ('personaggio' | 'master' | 'moderatore' | 'amministratore')[];
  characterPermissions?: string[];

  // No more legacy fields - using only granular system
  iat: number; // issued at
  exp: number; // expires at
}

// Alias for backward compatibility
export type AuthTokenPayload = AuthToken;

export interface CharacterContextToken {
  userId: string;
  characterId: string;
  characterName: string;
  isApproved: boolean;
  gameplayRoles?: string[]; // Character gameplay roles (personaggio, master, moderatore, etc.)
  // Game permissions system
  isGestore?: boolean; // Super-admin bypass flag
  status?: string; // DRAFT, PENDING_APPROVAL, APPROVED, DELETED
  characterPermissions?: string[]; // Granular permission overrides
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