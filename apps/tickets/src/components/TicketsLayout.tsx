import { ReactNode, useEffect, useState } from 'react';
import { AuthContext } from '@/lib/auth';
import { CharacterSwitcher } from './CharacterSwitcher';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '@/styles/components/TicketsLayout.module.scss';

interface TicketsLayoutProps {
  children: ReactNode;
  authContext: AuthContext;
}

export function TicketsLayout({ children, authContext }: TicketsLayoutProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  // Avoid SSR hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Show loading during SSR and initial client-side hydration
  if (!isMounted || authContext.isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingText}>Caricamento...</div>
      </div>
    );
  }

  if (!authContext.user) {
    return (
      <div className={styles.accessDenied}>
        <div className={styles.accessContent}>
          <p className={styles.accessTitle}>Accesso richiesto</p>
          <a 
            href="https://tenpennynovels.com" 
            className={styles.loginLink}
          >
            Vai al login
          </a>
        </div>
      </div>
    );
  }

  const isStaffMember = authContext.character?.gameplayRoles?.some(role => 
    ['master', 'moderatore', 'amministratore'].includes(role)
  );

  return (
    <div className={styles.layoutContainer}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          {/* Logo */}
          <Link href="/">
            <div className={styles.logo}>
              <div className={styles.logoIcon}>
                <span>🎫</span>
              </div>
              <div className={styles.logoText}>
                <h1 className={styles.title}>Tickets</h1>
                <p className={styles.subtitle}>TenpennyNovels</p>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className={styles.navigation}>
            <Link href="/tickets/my-tickets">
              <span className={`${styles.navLink} ${
                router.pathname.includes('/my-tickets') ? styles.active : ''
              }`}>
                I Miei Ticket
              </span>
            </Link>
            
            {isStaffMember && (
              <>
                <Link href="/tickets/department-tickets">
                  <span className={`${styles.navLink} ${
                    router.pathname.includes('/department-tickets') ? styles.active : ''
                  }`}>
                    Dipartimento
                  </span>
                </Link>
                
                <Link href="/tickets/all-tickets">
                  <span className={`${styles.navLink} ${
                    router.pathname.includes('/all-tickets') ? styles.active : ''
                  }`}>
                    Tutti i Ticket
                  </span>
                </Link>
              </>
            )}
          </nav>

          {/* User Section */}
          <div className={styles.userSection}>
            {authContext.character && (
              <div className={styles.characterInfo}>
                <div className={styles.characterDetails}>
                  <div className={styles.characterName}>
                    {authContext.character.name} {authContext.character.surname}
                  </div>
                  {authContext.character.gameplayRoles && authContext.character.gameplayRoles.length > 0 && (
                    <div className={styles.characterRoles}>
                      {authContext.character.gameplayRoles.join(', ')}
                    </div>
                  )}
                </div>
                
                {authContext.availableCharacters && authContext.availableCharacters.length > 1 && (
                  <CharacterSwitcher
                    currentCharacter={authContext.character}
                    availableCharacters={authContext.availableCharacters}
                  />
                )}
              </div>
            )}
            
            {/* Game Link */}
            <a 
              href="https://game.tenpennynovels.com" 
              className={styles.gameLink}
            >
              🎮 Torna al Gioco
            </a>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className={styles.mobileNavigation}>
        <div className={styles.mobileNavContent}>
          <Link href="/tickets/my-tickets">
            <span className={`${styles.mobileNavLink} ${
              router.pathname.includes('/my-tickets') ? styles.active : ''
            }`}>
              I Miei Ticket
            </span>
          </Link>
          
          {isStaffMember && (
            <>
              <Link href="/tickets/department-tickets">
                <span className={`${styles.mobileNavLink} ${
                  router.pathname.includes('/department-tickets') ? styles.active : ''
                }`}>
                  Dipartimento
                </span>
              </Link>
              
              <Link href="/tickets/all-tickets">
                <span className={`${styles.mobileNavLink} ${
                  router.pathname.includes('/all-tickets') ? styles.active : ''
                }`}>
                  Tutti i Ticket
                </span>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Content */}
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
}