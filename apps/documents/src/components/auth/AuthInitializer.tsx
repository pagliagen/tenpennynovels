'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import styles from '@/styles/components/auth/AuthInitializer.module.scss';

interface AuthInitializerProps {
  children: ReactNode;
}

export function AuthInitializer({ children }: AuthInitializerProps): JSX.Element {
  // Auth check runs in background - non-blocking
  // Components check isAuthenticated to show/hide favorites UI
  useAuth();

  // Always render children immediately - don't wait for auth
  return <>{children}</>;
}
