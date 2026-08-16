/**
 * ManagementLayout - Main layout wrapper
 *
 * Features:
 * - Auth check (redirect se cookie mancante)
 * - Header con user dropdown
 * - Sidebar navigation
 * - Main content area
 *
 * CRITICAL: NO pagina login, redirect a apps/landing
 */

import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';
import { usePermissionsStore } from '@/store/permissionsStore';
import { useFeatureFlagsStore } from '@/store/featureFlagsStore';
import { Sidebar } from './Sidebar';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ToastContainer } from '@/components/shared/ToastContainer';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import styles from '@/styles/components/ManagementLayout.module.scss';

export interface ManagementLayoutProps {
  children: React.ReactNode;
}

export function ManagementLayout({ children }: ManagementLayoutProps): React.ReactElement {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const { loadPermissions, clearPermissions } = usePermissionsStore();
  const { loadFeatureFlags, clearFeatureFlags } = useFeatureFlagsStore();

  useAdminNotifications();

  // Auth check - redirect to landing if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // CRITICAL: Login gestito da apps/landing
      const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:4000';
      window.location.href = `${landingUrl}`;
    }
  }, [isLoading, isAuthenticated]);

  // Check admin panel access permission
  useEffect(() => {
    if (isAuthenticated && user && !user.canAccessAdminPanel) {
      // User authenticated but no admin access
      window.location.href = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:4000';
    }
  }, [isAuthenticated, user]);

  // Load permissions when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.canAccessAdminPanel) {
      loadPermissions();
      loadFeatureFlags();
    } else {
      clearPermissions();
      clearFeatureFlags();
    }
  }, [isAuthenticated, user?.canAccessAdminPanel, loadPermissions, clearPermissions, loadFeatureFlags, clearFeatureFlags]);

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <p className={styles.loadingText}>Caricamento...</p>
      </div>
    );
  }

  // Not authenticated - will redirect
  if (!isAuthenticated) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <p className={styles.loadingText}>Reindirizzamento...</p>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className={styles.mainWrapper}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <h1 className={styles.logo}>Ten Penny Novels</h1>
            <div className={styles.headerActions}>
              <NotificationBell />
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user?.displayName || user?.username}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className={styles.main}>
          {children}
        </main>

        {/* Footer */}
        <footer className={styles.footer}>
          <p>© 2026 Ten Penny Novels - Management Panel v1.0.0</p>
        </footer>
      </div>

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
}
