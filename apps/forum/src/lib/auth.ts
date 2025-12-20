// Forum Authentication Integration
// Handles both user tokens and character tokens from cookies

import { parse as parseCookies } from 'cookie';

export interface AuthTokens {
  auth_token?: string;
  character_context?: string;
}

export interface UserInfo {
  userId: string;
  username: string;
  email?: string;
  canAccessAdminPanel?: boolean;
  // New granular permission system
  userRoles?: string[];
  characterRoles?: string[];
  characterPermissions?: string[];
}

export interface CharacterInfo {
  characterId: string;
  characterName: string;
  characterSurname?: string;
  gameplayRoles?: string[];
  isApproved?: boolean;
  locationId?: string;
}

export interface AuthContext {
  isAuthenticated: boolean;
  user?: UserInfo;
  character?: CharacterInfo;
  tokens: AuthTokens;
}

/**
 * Parse authentication tokens from request headers or document cookies
 */
export function parseAuthTokens(cookieHeader?: string): AuthTokens {
  if (typeof window !== 'undefined') {
    // Client-side: parse from document.cookie
    const cookies = parseCookies(document.cookie);
    return {
      auth_token: cookies.auth_token,
      character_context: cookies.character_context,
    };
  } else {
    // Server-side: parse from request headers
    if (!cookieHeader) return {};
    const cookies = parseCookies(cookieHeader);
    return {
      auth_token: cookies.auth_token,
      character_context: cookies.character_context,
    };
  }
}

/**
 * Decode JWT token (basic implementation - in production should use proper JWT library)
 */
export function decodeToken(token: string): any {
  try {
    const payload = token.split('.')[1];
    
    // Client-side compatible base64 decode
    let decoded: string;
    if (typeof window !== 'undefined') {
      // Browser environment - use atob
      decoded = atob(payload);
    } else {
      // Node.js environment - use Buffer
      decoded = Buffer.from(payload, 'base64').toString('utf8');
    }
    
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
}

/**
 * Extract user information from auth token
 */
export function getUserFromToken(authToken: string): UserInfo | null {
  const decoded = decodeToken(authToken);
  if (!decoded) return null;
  
  return {
    userId: decoded.userId,
    username: decoded.username,
    email: decoded.email || null,
    canAccessAdminPanel: decoded.canAccessAdminPanel || false,
    // New granular permission system
    userRoles: decoded.userRoles || ['user'],
    characterRoles: decoded.characterRoles || ['personaggio'],
    characterPermissions: decoded.characterPermissions || []
  };
}

/**
 * Extract character information from character context token
 */
export function getCharacterFromToken(characterToken: string): CharacterInfo | null {
  const decoded = decodeToken(characterToken);
  if (!decoded) return null;
  
  return {
    characterId: decoded.characterId,
    characterName: decoded.characterName,
    characterSurname: decoded.characterSurname || null,
    gameplayRoles: decoded.gameplayRoles || [],
    isApproved: decoded.status === 'APPROVED',
    locationId: decoded.currentLocationId || null,
  };
}

/**
 * Build complete authentication context from tokens
 */
export function buildAuthContext(tokens: AuthTokens): AuthContext {
  const user = tokens.auth_token ? getUserFromToken(tokens.auth_token) : undefined;
  const character = tokens.character_context ? getCharacterFromToken(tokens.character_context) : undefined;
  
  return {
    isAuthenticated: !!tokens.auth_token,
    user: user || undefined,
    character: character || undefined,
    tokens,
  };
}

/**
 * Check if user has specific permission using granular system
 */
export function hasPermission(user: UserInfo | undefined, permission: string): boolean {
  if (!user?.canAccessAdminPanel) return false;
  
  // Check new granular system
  if (user.userRoles?.includes('gestore')) return true;
  if (user.characterPermissions?.includes(permission)) return true;
  
  return false;
}

/**
 * Check if user can moderate forum content
 */
export function canModerateContent(user: UserInfo | undefined): boolean {
  return hasPermission(user, 'forum.moderate') || hasPermission(user, 'forum.manage');
}

/**
 * Check if user can manage forums (create topics, sticky, lock, etc.)
 */
export function canManageForums(user: UserInfo | undefined): boolean {
  return hasPermission(user, 'forum.manage');
}

/**
 * Check if user can delete posts/topics
 */
export function canDeletePosts(user: UserInfo | undefined): boolean {
  return hasPermission(user, 'forum.delete') || hasPermission(user, 'forum.manage');
}

/**
 * Check if character has specific gameplay role
 */
export function hasGameplayRole(character: CharacterInfo | undefined, role: string): boolean {
  if (!character?.gameplayRoles) return false;
  return character.gameplayRoles.includes(role);
}

/**
 * Check if user/character can access private forum areas
 */
export function canAccessPrivateForums(user: UserInfo | undefined, character: CharacterInfo | undefined): boolean {
  // Private forums require both user authentication and approved character
  return !!(user && character?.isApproved);
}