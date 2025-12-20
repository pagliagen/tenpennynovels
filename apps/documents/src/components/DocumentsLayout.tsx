import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import styles from '@/styles/components/DocumentsLayout.module.scss';
import { AuthContext } from '@/lib/auth';
import { getDocuments, Document } from '@/lib/documentApi';

interface Breadcrumb {
  label: string;
  href: string;
}

interface DocumentsLayoutProps {
  children: React.ReactNode;
  authContext: AuthContext;
  title?: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  sidebarContent?: React.ReactNode;
}

export const DocumentsLayout: React.FC<DocumentsLayoutProps> = ({
  children,
  authContext,
  title = 'Documenti - TenpennyNovels',
  description = 'Ambientazione e regolamento per il GDR di Londra Vittoriana',
  breadcrumbs,
  sidebarContent
}) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isDesktopSearchExpanded, setIsDesktopSearchExpanded] = useState(false);
  const [isIndexMenuOpen, setIsIndexMenuOpen] = useState(false);

  // Load documents for sidebar
  useEffect(() => {
    async function loadDocuments() {
      try {
        const allDocs = await getDocuments();
        setDocuments(allDocs);
      } catch (error) {
        console.error('Error loading documents:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDocuments();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLoginRedirect = () => {
    window.location.href = process.env.NEXT_PUBLIC_LANDING_URL || 'https://tenpennynovels.com';
  };

  // Organize documents by type and group from database
  const ambientazioneDocuments = documents.filter(doc => doc.type === 'ambientazione');
  const regolamentoDocuments = documents.filter(doc => doc.type === 'regolamento');

  // Group documents using the actual group field from database
  const groupDocumentsByField = (docs: Document[]) => {
    const grouped: Record<string, Document[]> = {};

    docs.forEach(doc => {
      const group = doc.group || 'Altri';
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push(doc);
    });

    return grouped;
  };

  const ambientazioneGroups = groupDocumentsByField(ambientazioneDocuments);
  const regolamentoGroups = groupDocumentsByField(regolamentoDocuments);

  // Determine current section from router path
  const currentSection = router.pathname.startsWith('/ambientazione') ? 'ambientazione' :
    router.pathname.startsWith('/regolamento') ? 'regolamento' :
    router.pathname === '/preferiti' ? 'preferiti' :
      'ambientazione'; // default to ambientazione

  // Determine if we're on an index page (should show document list) or detail page (should not)
  const isIndexPage = router.pathname === '/ambientazione' || 
                      router.pathname === '/regolamento' || 
                      router.pathname === '/preferiti' ||
                      router.pathname === '/';

  // Get current document slug from router query (for dynamic routes)
  const getCurrentDocumentSlug = () => {
    console.log('Router pathname:', router.pathname);
    console.log('Router query:', router.query);
    
    // For dynamic routes like /ambientazione/[slug] or /regolamento/[slug]
    const slug = router.query.slug as string;
    console.log('Current document slug:', slug);
    return slug || null;
  };
  
  const currentDocumentSlug = getCurrentDocumentSlug();

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png" />
      </Head>

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
      <div className={styles.documentsContainerDesktop}>
        <main className={styles.mainContent}>
          <div className={styles.contentWrapper}>

            {/* Desktop Sidebar */}
            <aside className={styles.sidebar}>
              <div className={styles.logoSection}>
                <img src="/images/title.png" alt="TenpennyNovels" className={styles.titleLogo} />
              </div>

              {/* Show only current section */}
              {currentSection === 'ambientazione' && (
                <div className={styles.sidebarSection}>
                  <h3 className={styles.sidebarTitle}>AMBIENTAZIONE</h3>
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                      <p>Caricamento...</p>
                    </div>
                  ) : (
                    <div className={styles.documentTree}>
                      {Object.entries(ambientazioneGroups).map(([groupName, docs]) => (
                        <div key={groupName} className={styles.documentGroup}>
                          <h4 className={styles.groupTitle}>{groupName}</h4>
                          <ul className={styles.documentList}>
                            {docs.map((doc) => {
                              const isActive = currentDocumentSlug === doc.slug;
                              
                              return (
                                <li key={doc.id || doc.slug}>
                                  <Link 
                                    href={`/ambientazione/${doc.slug}`} 
                                    className={`${styles.documentLink} ${isActive ? styles.active : ''}`}
                                  >
                                    {doc.title}{isActive ? ' ♦' : ''}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Desktop Regolamento Section */}
              {currentSection === 'regolamento' && regolamentoDocuments.length > 0 && (
                <div className={styles.sidebarSection}>
                  <h3 className={styles.sidebarTitle}>REGOLAMENTO</h3>
                  <div className={styles.documentTree}>
                    {Object.entries(regolamentoGroups).map(([groupName, docs]) => (
                      docs.length > 0 && (
                        <div key={groupName} className={styles.documentGroup}>
                          <h4 className={styles.groupTitle}>{groupName}</h4>
                          <ul className={styles.documentList}>
                            {docs.map((doc) => {
                              const isActive = currentDocumentSlug === doc.slug;
                              
                              return (
                                <li key={doc.id || doc.slug}>
                                  <Link 
                                    href={`/regolamento/${doc.slug}`} 
                                    className={`${styles.documentLink} ${isActive ? styles.active : ''}`}
                                  >
                                    {doc.title}{isActive ? ' ♦' : ''}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}

              {/* Additional sidebar content */}
              {sidebarContent}
            </aside>

            {/* Desktop Content Area */}
            <div className={styles.contentArea}>
              {/* Desktop Header with Navigation */}
              <header className={styles.header}>
                <div className={styles.headerContent}>
                  <div className={styles.navigationSection}>
                    <nav className={styles.primaryNav}>
                      <Link
                        href="/ambientazione"
                        className={`${styles.navButton} ${currentSection === 'ambientazione' ? styles.active : ''}`}
                      >
                        AMBIENTAZIONE
                      </Link>
                      <Link
                        href="/regolamento"
                        className={`${styles.navButton} ${currentSection === 'regolamento' ? styles.active : ''}`}
                      >
                        REGOLAMENTO
                      </Link>
                      <Link 
                        href="/preferiti" 
                        className={`${styles.navButton} ${currentSection === 'preferiti' ? styles.active : ''}`}
                      >
                        PREFERITI
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
                          placeholder="ricerca per parola o frase"
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
      <div className={styles.documentsContainerMobile}>
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
                placeholder="Cerca nei documenti..."
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
              <Link
                href="/ambientazione"
                className={`${styles.mobileNavButton} ${currentSection === 'ambientazione' ? styles.active : ''}`}
              >
                AMBIENTAZIONE
              </Link>
              <Link
                href="/regolamento"
                className={`${styles.mobileNavButton} ${currentSection === 'regolamento' ? styles.active : ''}`}
              >
                REGOLAMENTO
              </Link>
              <Link 
                href="/preferiti" 
                className={`${styles.mobileNavButton} ${currentSection === 'preferiti' ? styles.active : ''}`}
              >
                PREFERITI
              </Link>
            </div>
          </nav>

          {/* Mobile Index Menu - part of sticky header */}
          {(currentSection === 'ambientazione' || currentSection === 'regolamento') && (
            <div className={styles.mobileIndexMenu}>
              <button 
                className={styles.indexMenuToggle}
                onClick={() => setIsIndexMenuOpen(!isIndexMenuOpen)}
              >
                Indice della pagina
                <span className={`${styles.dropdownArrow} ${isIndexMenuOpen ? styles.open : ''}`}>
                  ▼
                </span>
              </button>
              
              {isIndexMenuOpen && (
                <div className={styles.indexMenuDropdown}>
                  {currentSection === 'ambientazione' && (
                    <div className={styles.indexMenuContent}>
                      {loading ? (
                        <div className={styles.indexMenuLoading}>Caricamento...</div>
                      ) : (
                        Object.entries(ambientazioneGroups).map(([groupName, docs]) => (
                          <div key={groupName} className={styles.indexMenuGroup}>
                            <h4 className={styles.indexMenuGroupTitle}>{groupName}</h4>
                            {docs.map((doc) => (
                              <Link 
                                key={doc.id || doc.slug}
                                href={`/ambientazione/${doc.slug}`}
                                className={styles.indexMenuItem}
                                onClick={() => setIsIndexMenuOpen(false)}
                              >
                                {doc.title}
                              </Link>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {currentSection === 'regolamento' && regolamentoDocuments.length > 0 && (
                    <div className={styles.indexMenuContent}>
                      {Object.entries(regolamentoGroups).map(([groupName, docs]) => (
                        docs.length > 0 && (
                          <div key={groupName} className={styles.indexMenuGroup}>
                            <h4 className={styles.indexMenuGroupTitle}>{groupName}</h4>
                            {docs.map((doc) => (
                              <Link 
                                key={doc.id || doc.slug}
                                href={`/regolamento/${doc.slug}`}
                                className={styles.indexMenuItem}
                                onClick={() => setIsIndexMenuOpen(false)}
                              >
                                {doc.title}
                              </Link>
                            ))}
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
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