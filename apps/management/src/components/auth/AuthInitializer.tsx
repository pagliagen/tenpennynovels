/**
 * Auth Initializer Component
 *
 * Wraps the application and handles session verification on mount.
 * Shows loading state while checking session.
 * Shows error page if session check fails.
 *
 * @module components/auth/AuthInitializer
 * @since 1.0.0
 */

'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthError } from './AuthError';

/**
 * Auth Initializer Props
 *
 * @interface AuthInitializerProps
 * @since 1.0.0
 */
interface AuthInitializerProps {
  children: ReactNode;
}

/**
 * Auth Initializer Component
 *
 * Verifies session on mount before rendering children.
 * Handles loading state and error display.
 *
 * @component
 * @param {AuthInitializerProps} props - Component props
 * @returns {JSX.Element}
 * @since 1.0.0
 */
export function AuthInitializer({ children }: AuthInitializerProps): JSX.Element {
  const { isLoading, isInitialized, error, errorType } = useAuth();

  // Show error page if session check failed
  if (error && errorType) {
    return <AuthError type={errorType} message={error} />;
  }

  // Show loading state while checking session
  if (isLoading || !isInitialized) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '1.5rem',
          color: '#555',
        }}
      >
        Verifying session...
      </div>
    );
  }

  return <>{children}</>;
}
