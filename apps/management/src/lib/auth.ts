// =============================================================================
// Authentication Library - Management Panel
// =============================================================================

import { useState, useEffect } from 'react';

export interface User {
  id: string;
  username: string;
  email: string;
  canAccessAdminPanel: boolean;
  // New granular permission system
  userRoles?: string[];
  characterRoles?: string[];
  characterPermissions?: string[];
  // No more legacy fields - using only granular system
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  createdAt: Date;
  lastLoginAt?: Date;
  // Additional properties from backend
  effectivePermissions?: any;
  visibleBadges?: string[];
  visibleMenu?: any;
}

export interface Character {
  id: string;
  name: string;
  surname?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  gameplayRoles: string[]; // personaggio, master, moderatore, gestore
  userId: string;
  createdAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  avatarUrl?: string;
}

export interface AuthContext {
  isAuthenticated: boolean;
  user: User | null;
  character: Character | null;
  availableCharacters?: Character[];
  isLoading: boolean;
}


// =============================================================================
// Role Checking Utilities
// =============================================================================

export function hasAdminRole(user: User | null, roles: string[]): boolean {
  if (!user || !user.canAccessAdminPanel) return false;
  if (roles.length === 0) return true;
  
  // Check new granular system first
  if (user.userRoles?.includes('gestore')) return true;
  if (user.characterRoles) {
    if (roles.some(role => user.characterRoles!.includes(role))) return true;
  }
  
  return false;
}

export function hasAdminPermission(user: User | null, permissions: string[]): boolean {
  if (!user || !user.canAccessAdminPanel) return false;
  if (permissions.length === 0) return true;
  
  // Check new granular system first
  if (user.userRoles?.includes('gestore')) return true;
  if (user.characterPermissions) {
    if (permissions.some(permission => user.characterPermissions!.includes(permission))) return true;
  }
  
  return false;
}

export function getHighestAdminRole(user: User | null): string | null {
  if (!user || !user.canAccessAdminPanel) return null;
  
  // Check new granular system first
  if (user.userRoles?.includes('gestore')) return 'gestore';
  
  const roleHierarchy = ['amministratore', 'master', 'moderatore', 'personaggio'];
  if (user.characterRoles) {
    for (const role of roleHierarchy) {
      if (user.characterRoles.includes(role)) {
        return role;
      }
    }
  }
  
  return null;
}

export function getRoleColor(role: string): string {
  const roleColors: Record<string, string> = {
    gestore: '#dc2626',    // Red - Full access
    admin: '#ea580c',      // Orange - High access
    master: '#d4af37',     // Gold - Game master
    moderatore: '#059669', // Green - Moderation
  };
  return roleColors[role] || '#6b7280';
}

// =============================================================================
// API Utilities
// =============================================================================

export async function apiRequest<T = any>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; error?: string }> {
  const gatewayUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';
  const url = endpoint.startsWith('http') ? endpoint : `${gatewayUrl}${endpoint}`;
  
  const config: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    return {
      success: response.ok,
      data: response.ok ? data.data : undefined,
      message: data.message,
      error: response.ok ? undefined : data.error || 'Request failed',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// =============================================================================
// React Hook for Authentication
// =============================================================================

export function useAuth() {
  const [authContext, setAuthContext] = useState<AuthContext>({
    isAuthenticated: false,
    user: null,
    character: null,
    availableCharacters: [],
    isLoading: true
  });

  useEffect(() => {
    const fetchAuthData = async () => {
      try {
        // Check for characterId in URL params
        const urlParams = new URLSearchParams(window.location.search);
        const characterId = urlParams.get('characterId');
        
        // Build the API endpoint with characterId if present
        const endpoint = characterId ? `/admin/me?characterId=${characterId}` : '/admin/me';
        const response = await apiRequest<{user: User, character: Character, availableCharacters: Character[]}>(endpoint);
        
        if (response.success && response.data) {
          setAuthContext({
            isAuthenticated: true,
            user: response.data.user,
            character: response.data.character,
            availableCharacters: response.data.availableCharacters || [],
            isLoading: false
          });
        } else {
          setAuthContext({
            isAuthenticated: false,
            user: null,
            character: null,
            availableCharacters: [],
            isLoading: false
          });
        }
      } catch (error) {
        console.error('Error fetching auth data:', error);
        setAuthContext({
          isAuthenticated: false,
          user: null,
          character: null,
          availableCharacters: [],
          isLoading: false
        });
      }
    };

    fetchAuthData();
  }, []);

  return { authContext };
}

