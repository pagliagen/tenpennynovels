import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import styles from '@/styles/components/ForumLayout.module.scss';
import { AuthContext } from '@/lib/auth';
import { ForumStats } from '@/components/ForumStats';

interface ForumLayoutProps {
  children: React.ReactNode;
  authContext: AuthContext;
  title?: string;
  description?: string;
}

export const ForumLayout: React.FC<ForumLayoutProps> = ({ 
  children, 
  authContext,
  title = 'TenpennyNovels Forum',
  description = 'Discussioni e community per il GDR di Londra Vittoriana'
}) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isDesktopSearchExpanded, setIsDesktopSearchExpanded] = useState(false);
  const [isIndexMenuOpen, setIsIndexMenuOpen] = useState(false);

  // Generate dynamic breadcrumbs based on route
  const generateBreadcrumbs = () => {
    const path = router.pathname;
    const segments = path.split('/').filter(Boolean);
    
    if (segments.length === 0) {
      return null; // Home page
    }

    const breadcrumbs = [];
    
    // Handle specific routes
    if (segments[0] === 'recent') {
      breadcrumbs.push({ label: 'Discussioni Recenti', href: '/recent' });
    } else if (segments[0] === 'popular') {
      breadcrumbs.push({ label: 'Discussioni Popolari', href: '/popular' });
    } else if (segments[0] === 'favorites') {
      breadcrumbs.push({ label: 'I Miei Preferiti', href: '/favorites' });
    } else if (segments[0] === 'search') {
      breadcrumbs.push({ label: 'Ricerca', href: '/search' });
    } else if (segments.length >= 1) {
      // Topic and discussion pages
      const topicSlug = segments[0];
      const discussionSlug = segments[1];
      
      // Add topic breadcrumb (we'd need to fetch topic title, for now use slug)
      const topicLabel = topicSlug.replace(/-/g, ' ').replace(/\w\S*/g, (txt) => 
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      );
      
      if (discussionSlug) {
        // If we have a discussion, topic is a link
        breadcrumbs.push({ 
          label: topicLabel, 
          href: `/${topicSlug}` 
        });
        
        // Add discussion breadcrumb as current page
        breadcrumbs.push({ 
          label: discussionSlug.replace(/-/g, ' ').replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
          ), 
          href: `/${topicSlug}/${discussionSlug}` 
        });
      } else {
        // If we're on a topic page, topic is the current page
        breadcrumbs.push({ 
          label: topicLabel, 
          href: `/${topicSlug}` 
        });
      }
    }

    return breadcrumbs;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLoginRedirect = () => {
    // Redirect to landing page for authentication
    window.location.href = process.env.NEXT_PUBLIC_LANDING_URL || 'https://tenpennynovels.com';
  };

  const handleGameRedirect = () => {
    // Redirect to game interface
    window.location.href = process.env.NEXT_PUBLIC_GAME_URL || 'https://game.tenpennynovels.com';
  };

  const handleDocsRedirect = () => {
    // Redirect to documents
    window.location.href = process.env.NEXT_PUBLIC_DOCS_URL || 'https://documenti.tenpennynovels.com';
  };

  const handleManagementRedirect = () => {
    // Redirect to management interface
    window.location.href = process.env.NEXT_PUBLIC_MANAGEMENT_URL || 'https://gestione.tenpennynovels.com';
  };

  return (
    <>
      {/* SVG Filter Definition - needs to be global */}
      <svg style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}>
        <defs>
          <filter id="crumple-effect">
            <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="20" result="turbulence" />
            <feDisplacementMap in2="turbulence" in="SourceGraphic" scale="50" />
          </filter>
        </defs>
      </svg>

      {/* DESKTOP LAYOUT */}
      <div className={styles.forumContainerDesktop}>
        <main className={styles.mainContent}>
          <div className={styles.contentWrapper}>

            {/* Desktop Sidebar */}
            <aside className={styles.sidebar}>
              <div className={styles.logoSection}>
                <img src="/images/title.png" alt="TenpennyNovels" className={styles.titleLogo} />
              </div>

              <div className={styles.sidebarSection}>
                <h3 className={styles.sidebarTitle}>NAVIGAZIONE</h3>
                <div className={styles.documentTree}>
                  <div className={styles.documentGroup}>
                    <ul className={styles.documentList}>
                      <li>
                        <Link href="/" className={styles.documentLink}>
                          Tutti gli Argomenti
                        </Link>
                      </li>
                      <li>
                        <Link href="/recent" className={styles.documentLink}>
                          Discussioni Recenti
                        </Link>
                      </li>
                      <li>
                        <Link href="/popular" className={styles.documentLink}>
                          Discussioni Popolari
                        </Link>
                      </li>
                      {authContext.isAuthenticated && (
                        <>
                          <li>
                            <Link href="/favorites" className={styles.documentLink}>
                              I Miei Preferiti
                            </Link>
                          </li>
                          <li>
                            <Link href="/my-posts" className={styles.documentLink}>
                              I Miei Post
                            </Link>
                          </li>
                          <li>
                            <Link href="/subscriptions" className={styles.documentLink}>
                              Discussioni Seguite
                            </Link>
                          </li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              {authContext.character?.isApproved && (
                <div className={styles.sidebarSection}>
                  <h3 className={styles.sidebarTitle}>AREA PERSONAGGI</h3>
                  <div className={styles.documentTree}>
                    <div className={styles.documentGroup}>
                      <ul className={styles.documentList}>
                        <li>
                          <Link href="/private/general" className={styles.documentLink}>
                            Discussioni Private
                          </Link>
                        </li>
                        <li>
                          <Link href="/private/roleplay" className={styles.documentLink}>
                            Area Roleplay
                          </Link>
                        </li>
                        <li>
                          <Link href="/private/trade" className={styles.documentLink}>
                            Commercio
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {(authContext.user?.canAccessAdminPanel || 
                authContext.character?.gameplayRoles?.includes('master') ||
                authContext.character?.gameplayRoles?.includes('moderatore')) && (
                <div className={styles.sidebarSection}>
                  <h3 className={styles.sidebarTitle}>MODERAZIONE</h3>
                  <div className={styles.documentTree}>
                    <div className={styles.documentGroup}>
                      <ul className={styles.documentList}>
                        <li>
                          <Link href="/moderation/reports" className={styles.documentLink}>
                            Segnalazioni
                          </Link>
                        </li>
                        <li>
                          <Link href="/moderation/logs" className={styles.documentLink}>
                            Log Moderazione
                          </Link>
                        </li>
                        {(authContext.user?.userRoles?.includes('gestore') || 
                          authContext.user?.characterPermissions?.includes('forum.manage')) && (
                          <li>
                            <Link href="/admin/topics" className={styles.documentLink}>
                              Gestione Argomenti
                            </Link>
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* User Info */}
              {authContext.isAuthenticated ? (
                <div className={styles.sidebarSection}>
                  <h3 className={styles.sidebarTitle}>UTENTE</h3>
                  <div className={styles.userCard}>
                    <div className={styles.userDetails}>
                      <span className={styles.username}>
                        {authContext.user?.username}
                      </span>
                      {authContext.character && (
                        <span className={styles.characterName}>
                          {authContext.character.characterName}
                          {authContext.character.characterSurname && 
                            ` ${authContext.character.characterSurname}`}
                        </span>
                      )}
                    </div>
                    <div className={styles.userBadges}>
                      {authContext.user?.canAccessAdminPanel && (
                        <span className={styles.adminBadge}>ADMIN</span>
                      )}
                      {authContext.character?.gameplayRoles?.includes('master') && (
                        <span className={styles.masterBadge}>MASTER</span>
                      )}
                      {authContext.character?.gameplayRoles?.includes('moderatore') && (
                        <span className={styles.modBadge}>MOD</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.sidebarSection}>
                  <button onClick={handleLoginRedirect} className={styles.loginButton}>
                    Login
                  </button>
                </div>
              )}

              <ForumStats />
            </aside>

            {/* Desktop Content Area */}
            <div className={styles.contentArea}>
              {/* Desktop Header with Navigation */}
              <header className={styles.header}>
                <div className={styles.headerContent}>
                  <div className={styles.navigationSection}>
                    <nav className={styles.primaryNav}>
                      <button onClick={handleGameRedirect} className={styles.navButton}>
                        GIOCO
                      </button>
                      <button onClick={handleDocsRedirect} className={styles.navButton}>
                        DOCUMENTI
                      </button>
                      <Link href="/regolamento" className={styles.navButton}>
                        REGOLAMENTO
                      </Link>
                    </nav>

                    <div className={styles.searchForm}>
                      {/* Desktop search toggle button (shown below 1100px) */}
                      <button 
                        type="button"
                        className={styles.desktopSearchToggle}
                        onClick={() => setIsDesktopSearchExpanded(!isDesktopSearchExpanded)}
                      >
                        🔍
                      </button>

                      {/* Desktop search form (always visible above 1100px, expandable below) */}
                      <form 
                        onSubmit={handleSearch} 
                        className={`${styles.desktopSearchContainer} ${isDesktopSearchExpanded ? styles.expanded : ''}`}
                      >
                        <input
                          type="text"
                          placeholder="ricerca nel forum..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className={styles.searchInput}
                        />
                        <button type="submit" className={styles.searchButton}>
                          🔍
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </header>

              <div className={styles.paperContainer}>
                <div className={styles.paperBackground}></div>
                <div className={styles.paperContent}>
                  {children}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* MOBILE LAYOUT */}
      <div className={styles.forumContainerMobile}>
        {/* Mobile Title Section - Not sticky, will scroll away */}
        <div className={styles.mobileTitleSection}>
          <img src="/images/title.png" alt="TenpennyNovels" className={styles.mobileTitleLogo} />
          <button 
            className={styles.searchToggle}
            onClick={() => setIsSearchExpanded(!isSearchExpanded)}
          >
            🔍
          </button>
        </div>

        {/* Mobile Search - Not sticky */}
        {isSearchExpanded && (
          <div className={styles.mobileSearchContainer}>
            <form onSubmit={handleSearch} className={styles.mobileSearchForm}>
              <input
                type="text"
                placeholder="Cerca nel forum..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.mobileSearchInput}
              />
              <button type="submit" className={styles.mobileSearchButton}>
                Cerca
              </button>
            </form>
          </div>
        )}

        {/* Mobile Sticky Header - Only navigation and index */}
        <div className={styles.mobileHeader}>
          <nav className={styles.mobileNav}>
            <div className={styles.mobileNavScroll}>
              <button onClick={handleGameRedirect} className={styles.mobileNavButton}>
                GIOCO
              </button>
              <button onClick={handleDocsRedirect} className={styles.mobileNavButton}>
                DOCUMENTI
              </button>
              <Link href="/regolamento" className={styles.mobileNavButton}>
                REGOLAMENTO
              </Link>
            </div>
          </nav>

          {/* Mobile Index Menu - part of sticky header */}
          <div className={styles.mobileIndexMenu}>
            <button 
              className={styles.indexMenuToggle}
              onClick={() => setIsIndexMenuOpen(!isIndexMenuOpen)}
            >
              Menu Forum
              <span className={`${styles.dropdownArrow} ${isIndexMenuOpen ? styles.open : ''}`}>
                ▼
              </span>
            </button>
            
            {isIndexMenuOpen && (
              <div className={styles.indexMenuDropdown}>
                <div className={styles.indexMenuContent}>
                  <div className={styles.indexMenuGroup}>
                    <h4 className={styles.indexMenuGroupTitle}>Navigazione</h4>
                    <Link href="/" className={styles.indexMenuItem} onClick={() => setIsIndexMenuOpen(false)}>
                      Tutti gli Argomenti
                    </Link>
                    <Link href="/recent" className={styles.indexMenuItem} onClick={() => setIsIndexMenuOpen(false)}>
                      Discussioni Recenti
                    </Link>
                    <Link href="/popular" className={styles.indexMenuItem} onClick={() => setIsIndexMenuOpen(false)}>
                      Discussioni Popolari
                    </Link>
                    {authContext.isAuthenticated && (
                      <>
                        <Link href="/favorites" className={styles.indexMenuItem} onClick={() => setIsIndexMenuOpen(false)}>
                          I Miei Preferiti
                        </Link>
                        <Link href="/my-posts" className={styles.indexMenuItem} onClick={() => setIsIndexMenuOpen(false)}>
                          I Miei Post
                        </Link>
                        <Link href="/subscriptions" className={styles.indexMenuItem} onClick={() => setIsIndexMenuOpen(false)}>
                          Discussioni Seguite
                        </Link>
                      </>
                    )}
                  </div>

                  {authContext.character?.isApproved && (
                    <div className={styles.indexMenuGroup}>
                      <h4 className={styles.indexMenuGroupTitle}>Area Personaggi</h4>
                      <Link href="/private/general" className={styles.indexMenuItem} onClick={() => setIsIndexMenuOpen(false)}>
                        Discussioni Private
                      </Link>
                      <Link href="/private/roleplay" className={styles.indexMenuItem} onClick={() => setIsIndexMenuOpen(false)}>
                        Area Roleplay
                      </Link>
                      <Link href="/private/trade" className={styles.indexMenuItem} onClick={() => setIsIndexMenuOpen(false)}>
                        Commercio
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Content */}
        <main className={styles.mobileMainContent}>
          <div className={styles.mobileContentArea}>
            {children}
          </div>
        </main>
      </div>
    </>
  );
};