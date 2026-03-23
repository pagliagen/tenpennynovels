/**
 * Auth Initializer Component
 *
 * Wraps the application and handles session verification on mount.
 * Shows loading state while checking session.
 * Shows error page if session check fails.
 *
 * @module components/auth/AuthInitializer
 * @since 2.0.0
 */

'use client';

import { ReactNode } from 'react';

import { useAuth } from '@/hooks/useAuth';
import styles from '@/styles/components/auth/AuthInitializer.module.scss';

import { AuthError } from './AuthError';

/**
 * Auth Initializer Props
 *
 * @interface AuthInitializerProps
 * @since 2.0.0
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
 * @since 2.0.0
 *
 * @example
 * ```tsx
 * <AuthInitializer>
 *   <App />
 * </AuthInitializer>
 * ```
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
      <div className={styles.loadingRoot}>
        Verifying session...
      </div>
    );
  }

  return <>{children}</>;
}
