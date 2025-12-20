import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import styles from '@/styles/components/ManagementLayout.module.scss';
import { AuthContext } from '@/lib/auth';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationBell } from './NotificationBell';
import { Sidebar } from './Sidebar';

interface ManagementLayoutProps {
  children: React.ReactNode;
  authContext?: AuthContext;
  title?: string;
  description?: string;
}


export const ManagementLayout: React.FC<ManagementLayoutProps> = ({ 
  children, 
  authContext,
  title = 'Pannello di Gestione - TenpennyNovels',
  description = 'Sistema di amministrazione per la Londra Vittoriana'
}) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Authentication check - FIRST PRIORITY
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!authContext) {
          router.push('/access-denied');
          return;
        }

        if (authContext.isLoading) {
          return;
        }

        // Check if user has admin panel access
        if (!authContext.user?.canAccessAdminPanel) {
          router.push('/access-denied');
          return;
        }

        setIsLoading(false);
      } catch (error) {
        router.push('/access-denied');
        return;
      }
    };

    checkAuth();
  }, [authContext, router]);


  // Show loading state during auth check
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <p>Verifica autorizzazioni...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      
      <AuthProvider authContext={authContext!}>
        <div className={styles.managementContainer}>
          {/* Urban Legends Style Sidebar */}
          <Sidebar authContext={authContext!} />

          {/* Main Content Area */}
          <div className={styles.contentArea}>
            {/* Top Header */}
            <header className={styles.header}>
              <div className={styles.headerLeft}></div>
              
              <div className={styles.headerRight}>
                <NotificationBell authContext={authContext} />
                
                <div className={styles.userProfile}>
                  <button 
                    onClick={() => window.location.href = process.env.GAME_URL || 'https://documenti.tenpennynovels.com'}
                    className={styles.backToGameButton}
                    title="Torna al Gioco"
                  >
                    🎭 Torna al Gioco
                  </button>
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className={styles.mainContent}>
              {children}
            </main>
          </div>
        </div>
      </AuthProvider>
    </>
  );
};