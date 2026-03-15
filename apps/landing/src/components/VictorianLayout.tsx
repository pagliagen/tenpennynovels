/**
 * Victorian Layout Component
 *
 * Main layout wrapper for the landing application.
 * Renders either VictorianLayoutDesktop (≥1024px) or VictorianLayoutMobile (<1024px).
 *
 * **Layout Structure**:
 * - Desktop: Left sidebar (logo + nav) + right content (background image + page content).
 * - Mobile: Hamburger, overlay nav, and content with background image.
 *
 * **Breakpoint**: 768px (aligned with design token $breakpoint-md).
 *
 * @module components/VictorianLayout
 */

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { VictorianLayoutDesktop } from './VictorianLayoutDesktop';
import { VictorianLayoutMobile } from './VictorianLayoutMobile';
import { TermsContent } from './content/TermsContent';
import { PrivacyContent } from './content/PrivacyContent';
import { CreditsContent } from './content/CreditsContent';

export interface VictorianLayoutProps {
  /** Page content to render inside the layout. */
  children: React.ReactNode;
  /** Optional subtitle (reserved for future use). */
  subtitle?: string;
  /** Optional info panel rendered above page content */
  pageInfo?: React.ReactNode;
  /** Optional active info type (for controlling externally, e.g., from register page) */
  activeInfo?: 'terms' | 'privacy' | 'credits' | null;
  /** Optional callback to set active info (for controlling externally) */
  onSetActiveInfo?: (info: 'terms' | 'privacy' | 'credits' | null) => void;
}

/** Breakpoint in px: viewport >= this is desktop. */
const LAYOUT_BREAKPOINT_PX = 1024;

/** Derives a page class from pathname (e.g. "/" → "login-page", "/register" → "register-page"). */
function getPageClass(pathname: string): string {
  if (!pathname || pathname === '/') return 'login-page';
  const segment = pathname
    .slice(1)
    .replace(/\//g, '-')    // replace all / with -
    .replace(/\[|\]/g, ''); // remove all [ and ]
  return segment ? `${segment}-page` : 'login-page';
}

/**
 * Documentation URL (external link).
 */
const DOCS_URL = process.env.NEXT_PUBLIC_DOCUMENTS_URL || 'http://localhost:4002';

/**
 * Victorian Layout
 *
 * Chooses Desktop or Mobile layout based on viewport width.
 * Keeps navigation state and handlers in one place; passes them to the active layout.
 */
export const VictorianLayout: React.FC<VictorianLayoutProps> = ({
  children,
  subtitle,
  pageInfo,
  activeInfo: externalActiveInfo,
  onSetActiveInfo: externalSetActiveInfo,
}) => {
  const router = useRouter();
  const isDesktop = useIsDesktop(LAYOUT_BREAKPOINT_PX);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [internalActiveInfo, setInternalActiveInfo] = useState<'terms' | 'privacy' | 'credits' | null>(null);

  // Use external state if provided, otherwise use internal state
  const activeInfo = externalActiveInfo !== undefined ? externalActiveInfo : internalActiveInfo;
  const setActiveInfo = externalSetActiveInfo || setInternalActiveInfo;

  const isInfoPage = router.pathname === '/credits';

  const handleNavigate = useCallback(
    (path: string) => {
      router.push(path);
      setIsMobileMenuOpen(false);
    },
    [router]
  );

  const handleDocsClick = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.open(DOCS_URL, 'tpn-docs', 'noopener,noreferrer');
    }
    setIsMobileMenuOpen(false);
  }, []);

  const handleCreditsClick = useCallback(() => {
    // Toggle pattern: if already open, close; otherwise open
    setActiveInfo(activeInfo === 'credits' ? null : 'credits');
    setIsMobileMenuOpen(false);
  }, [activeInfo, setActiveInfo]);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const pageClass = getPageClass(router.pathname);

  // Info components map (same pattern as register.tsx)
  const infoComponents = {
    terms: <TermsContent />,
    privacy: <PrivacyContent />,
    credits: <CreditsContent />,
  } as const;

  // Modal info panel (only if no external pageInfo and activeInfo is set)
  const infoModal = !pageInfo && activeInfo ? (
    <>
      <div className="page-info-panel__close-container">
        <button
          type="button"
          className="page-info-panel__close"
          onClick={() => setActiveInfo(null)}
          aria-label="Chiudi"
        >
          ✕
        </button>
      </div>
      <div className="page-info-panel">
        {infoComponents[activeInfo]}
      </div>
    </>
  ) : undefined;

  // Use external pageInfo if provided, otherwise use infoModal
  const activePageInfo = pageInfo || infoModal;

  if (isDesktop) {
    return (
      <VictorianLayoutDesktop
        isInfoPage={isInfoPage}
        pageClass={pageClass}
        onNavigate={handleNavigate}
        onDocsClick={handleDocsClick}
        onCreditsClick={handleCreditsClick}
        pageInfo={activePageInfo}
      >
        {children}
      </VictorianLayoutDesktop>
    );
  }

  return (
    <VictorianLayoutMobile
      isInfoPage={isInfoPage}
      pageClass={pageClass}
      onNavigate={handleNavigate}
      onDocsClick={handleDocsClick}
      onCreditsClick={handleCreditsClick}
      isMobileMenuOpen={isMobileMenuOpen}
      onToggleMobileMenu={toggleMobileMenu}
      pageInfo={activePageInfo}
    >
      {children}
    </VictorianLayoutMobile>
  );
};
