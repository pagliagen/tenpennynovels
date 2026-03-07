'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import styles from '@/styles/components/auth/AuthInitializer.module.scss';

interface AuthInitializerProps {
  children: ReactNode;
}

export function AuthInitializer({ children }: AuthInitializerProps): JSX.Element {
  const { isInitialized } = useAuth();

  if (!isInitialized) {
    return (
      <div className={styles.loadingScreen}>
        Caricamento...
      </div>
    );
  }

  return <>{children}</>;
}
