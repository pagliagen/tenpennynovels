/**
 * Victorian Layout Component
 *
 * Main layout wrapper for the landing application.
 * Provides Victorian-era aesthetic with decorative elements and navigation.
 *
 * **Layout Structure**:
 * - Left side: Logo + vertical navigation
 * - Right side: Victorian window frame + content
 * - Mobile: Hamburger menu + overlay navigation
 *
 * **Visual Elements**:
 * - Background imagery (Victorian era)
 * - Decorative window frame with raven silhouette
 * - Golden ornamental accents
 * - Parchment textures
 *
 * @module components/VictorianLayout
 */

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Button } from './Button';

/**
 * Victorian layout props
 *
 * @interface VictorianLayoutProps
 */
export interface VictorianLayoutProps {
  /** Page content to render inside the window frame */
  children: React.ReactNode;
  /** Optional subtitle (currently unused, reserved for future) */
  subtitle?: string;
}

/**
 * Documentation URL
 *
 * External link to game documentation.
 */
const DOCS_URL = 'https://docs.tenpennynovels.com';

/**
 * Victorian Layout Component
 *
 * Renders the main Victorian-era themed layout with navigation.
 * Provides responsive design with mobile hamburger menu.
 *
 * **Desktop Layout**:
 * - Left sidebar: Logo + navigation buttons
 * - Right content: Victorian window frame + page content
 *
 * **Mobile Layout**:
 * - Hamburger menu (top-left)
 * - Overlay navigation (full-screen)
 * - Content below fold
 *
 * **Navigation**:
 * - Registrati: Go to registration page
 * - Documenti: External link to game docs
 * - Crediti: Go to credits page
 *
 * @param {VictorianLayoutProps} props - Component props
 * @returns {JSX.Element} Rendered Victorian layout
 *
 * @example
 * ```typescript
 * import { VictorianLayout } from '@/components/VictorianLayout';
 *
 * function LoginPage() {
 *   return (
 *     <VictorianLayout>
 *       <LoginForm />
 *     </VictorianLayout>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With SEO
 * function RegisterPage() {
 *   return (
 *     <>
 *       <SEO
 *         title="Registrati"
 *         description="Crea un account per giocare a TenpennyNovels"
 *       />
 *       <VictorianLayout>
 *         <RegisterForm />
 *       </VictorianLayout>
 *     </>
 *   );
 * }
 * ```
 */
export const VictorianLayout: React.FC<VictorianLayoutProps> = ({
  children 
}) => {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Check if current page is an info page (credits/privacy/terms)
  const isInfoPage = ['/credits', '/privacy', '/terms'].includes(router.pathname);

  /**
   * Toggles mobile navigation menu
   */
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  /**
   * Handles navigation to Documenti (external link)
   *
   * Opens documentation in current window (not new tab).
   * Closes mobile menu after navigation.
   */
  const handleDocsClick = () => {
    if (typeof window !== 'undefined') {
      window.location.href = DOCS_URL;
    }
    setIsMobileMenuOpen(false);
  };

  /**
   * Handles navigation to internal page
   *
   * @param {string} path - Route path to navigate to
   */
  const handleNavigate = (path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="victorian-layout">
      {/* Hamburger Menu (Mobile Only) */}
      <button
        type="button"
        className={`victorian-layout__hamburger ${isMobileMenuOpen ? 'victorian-layout__hamburger--open' : ''}`}
        onClick={toggleMobileMenu}
        aria-label="Menu di navigazione"
        aria-expanded={isMobileMenuOpen}
      >
        <span className="victorian-layout__hamburger-bar" />
        <span className="victorian-layout__hamburger-bar" />
        <span className="victorian-layout__hamburger-bar" />
      </button>

      {/* Mobile Navigation Overlay */}
      <div
        className={`victorian-layout__mobile-nav ${isMobileMenuOpen ? 'victorian-layout__mobile-nav--open' : ''}`}
      >
        <h2 className="victorian-layout__mobile-nav-title">Chapter One</h2>

        <nav className="victorian-layout__mobile-nav-content">
          {isInfoPage && (
            <Button
              variant="ghost"
              onClick={() => handleNavigate('/')}
              className="victorian-layout__nav-button"
            >
              Torna a Login
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={() => handleNavigate('/register')}
            className="victorian-layout__nav-button"
          >
            Registrati
          </Button>

          <Button
            variant="ghost"
            onClick={handleDocsClick}
            className="victorian-layout__nav-button"
          >
            Documenti
          </Button>

          <Button
            variant="ghost"
            onClick={() => handleNavigate('/credits')}
            className="victorian-layout__nav-button"
          >
            Crediti
          </Button>
        </nav>
      </div>

      {/* Left Sidebar (Desktop Only) */}
      <aside className="victorian-layout__sidebar">
        {/* Logo Section */}
        <div className="victorian-layout__logo" aria-label="TenpennyNovels" />

        {/* Navigation */}
        <nav className="victorian-layout__nav">
          <h2 className="victorian-layout__nav-title">Chapter One</h2>

          {isInfoPage && (
            <Button
              variant="ghost"
              onClick={() => handleNavigate('/')}
              className="victorian-layout__nav-button"
            >
              Torna a Login
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={() => handleNavigate('/register')}
            className="victorian-layout__nav-button"
          >
            Registrati
          </Button>

          <Button
            variant="ghost"
            onClick={handleDocsClick}
            className="victorian-layout__nav-button"
          >
            Documenti
          </Button>

          <Button
            variant="ghost"
            onClick={() => handleNavigate('/credits')}
            className="victorian-layout__nav-button"
          >
            Crediti
          </Button>
        </nav>
      </aside>

      {/* Main Content Area (Right Side) */}
      <main className="victorian-layout__content">
        {/* Background imagery */}
        <div className="victorian-layout__background" />

        {/* Mobile background (different image for small screens) */}
        <div className="victorian-layout__mobile-background" />

        {/* Page Content (positioned over window) */}
        <div className="victorian-layout__page-content"> 
          {children}
        </div>
      </main>
    </div>
  );
};
