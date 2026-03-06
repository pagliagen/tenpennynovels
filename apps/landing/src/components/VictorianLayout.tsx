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

export interface VictorianLayoutProps {
  /** Page content to render inside the layout. */
  children: React.ReactNode;
  /** Optional subtitle (reserved for future use). */
  subtitle?: string;
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
export const VictorianLayout: React.FC<VictorianLayoutProps> = ({ children, subtitle }) => {
  const router = useRouter();
  const isDesktop = useIsDesktop(LAYOUT_BREAKPOINT_PX);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isInfoPage = ['/credits', '/privacy', '/terms'].includes(router.pathname);

  const handleNavigate = useCallback(
    (path: string) => {
      router.push(path);
      setIsMobileMenuOpen(false);
    },
    [router]
  );

  const handleDocsClick = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.href = DOCS_URL;
    }
    setIsMobileMenuOpen(false);
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const pageClass = getPageClass(router.pathname);

  if (isDesktop) {
    return (
      <VictorianLayoutDesktop
        isInfoPage={isInfoPage}
        pageClass={pageClass}
        onNavigate={handleNavigate}
        onDocsClick={handleDocsClick}
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
      isMobileMenuOpen={isMobileMenuOpen}
      onToggleMobileMenu={toggleMobileMenu}
    >
      {children}
    </VictorianLayoutMobile>
  );
};
