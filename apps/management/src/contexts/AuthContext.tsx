// =============================================================================
// Auth Context Provider - Management Panel
// =============================================================================

import React, { createContext, useContext, ReactNode } from 'react';
import { AuthContext as AuthContextType } from '@/lib/auth';

// Create the React Context
const AuthReactContext = createContext<AuthContextType | null>(null);

// Export AuthContext for direct use in components (when needed)
export const AuthContext = AuthReactContext;

// Re-export AuthContextType for type imports
export type { AuthContextType };

// Provider component
interface AuthProviderProps {
  children: ReactNode;
  authContext: AuthContextType;
}

export function AuthProvider({ children, authContext }: AuthProviderProps) {
  return (
    <AuthReactContext.Provider value={authContext}>
      {children}
    </AuthReactContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthReactContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}