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
import { Sidebar } from './Sidebar';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ToastContainer } from '@/components/shared/ToastContainer';
import styles from '@/styles/components/ManagementLayout.module.scss';

export interface ManagementLayoutProps {
  children: React.ReactNode;
}

export function ManagementLayout({ children }: ManagementLayoutProps): React.ReactElement {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();

  // Auth check - redirect to landing if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // CRITICAL: Login gestito da apps/landing
      const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:4000';
      window.location.href = `${landingUrl}/auth/login`;
    }
  }, [isLoading, isAuthenticated]);

  // Check admin panel access permission
  useEffect(() => {
    if (isAuthenticated && user && !user.canAccessAdminPanel) {
      // User authenticated but no admin access
      window.location.href = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:4000';
    }
  }, [isAuthenticated, user]);

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
            <h1 className={styles.logo}>TenpennyNovels</h1>
            <div className={styles.headerActions}>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user?.displayName || user?.username}</span>
                <button
                  onClick={() => useAuthStore.getState().logout()}
                  className={styles.logoutButton}
                >
                  Logout
                </button>
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
          <p>© 2026 TenpennyNovels - Management Panel v1.0.0</p>
        </footer>
      </div>

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
}
