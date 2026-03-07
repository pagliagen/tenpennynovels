/**
 * Auth Initializer Component
 *
 * Non-blocking session check wrapper. Always renders children.
 * Shows a brief loading indicator while the session is being verified.
 *
 * @module components/auth/AuthInitializer
 * @since 2.0.0
 */

'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface AuthInitializerProps {
  children: ReactNode;
}

export function AuthInitializer({ children }: AuthInitializerProps): JSX.Element {
  const { isInitialized } = useAuth();

  if (!isInitialized) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'Playfair Display, serif',
          fontSize: '1.5rem',
          color: '#8B4513',
        }}
      >
        Caricamento...
      </div>
    );
  }

  return <>{children}</>;
}
