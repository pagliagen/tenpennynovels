/**
 * Victorian Layout — Mobile
 *
 * Mobile-only layout: hamburger, overlay nav, and main area with background image and content.
 * Rendered when viewport width < 1024px.
 *
 * @module components/VictorianLayoutMobile
 */

import React from 'react';
import { Button } from './Button';

/** Path for the Victorian background image. */
const BACKGROUND_IMAGE_SRC = '/images/sfondo.png';
const LOGO_IMAGE_SRC = '/images/title.png';

export interface VictorianLayoutMobileProps {
  /** Page content rendered inside the main area. */
  children: React.ReactNode;
  /** Page identifier for main content (e.g. "login-page", "register-page"). */
  pageClass: string;
  /** Called for internal navigation (e.g. /register). */
  onNavigate: (path: string) => void;
  /** Called when "Documenti" is clicked (external link). */
  onDocsClick: () => void;
  /** Called when "Crediti" is clicked (opens modal). */
  onCreditsClick: () => void;
  /** Whether the mobile nav overlay is open. */
  isMobileMenuOpen: boolean;
  /** Toggles the mobile nav overlay. */
  onToggleMobileMenu: () => void;
  /** Optional info panel rendered above page content */
  pageInfo?: React.ReactNode;
}

export const VictorianLayoutMobile: React.FC<VictorianLayoutMobileProps> = ({
  children,
  pageClass,
  onNavigate,
  onDocsClick,
  onCreditsClick,
  isMobileMenuOpen,
  onToggleMobileMenu,
  pageInfo,
}) => {
  return (
    <div className="victorian-layout-mobile">
      <button
        type="button"
        className={`victorian-layout-mobile__hamburger ${isMobileMenuOpen ? 'victorian-layout-mobile__hamburger--open' : ''}`}
        onClick={onToggleMobileMenu}
        aria-label="Menu di navigazione"
        aria-expanded={isMobileMenuOpen}
        aria-controls="victorian-mobile-nav"
      >
        <span className="victorian-layout-mobile__hamburger-bar" aria-hidden />
        <span className="victorian-layout-mobile__hamburger-bar" aria-hidden />
        <span className="victorian-layout-mobile__hamburger-bar" aria-hidden />
      </button>

      <div
        id="victorian-mobile-nav"
        className={`victorian-layout-mobile__nav ${isMobileMenuOpen ? 'victorian-layout-mobile__nav--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu di navigazione"
        aria-hidden={!isMobileMenuOpen}
      >
        <button
          type="button"
          className="victorian-layout-mobile__nav-close"
          onClick={onToggleMobileMenu}
          aria-label="Chiudi menu"
        >
          ✕
        </button>
        <nav className="victorian-layout-mobile__nav-content">
          <Button
            variant="ghost"
            onClick={() => onNavigate('/register')}
            className="victorian-layout-mobile__nav-button"
          >
            Registrati
          </Button>
          <Button
            variant="ghost"
            onClick={onDocsClick}
            className="victorian-layout-mobile__nav-button"
          >
            Documenti
          </Button>
          <Button
            variant="ghost"
            onClick={onCreditsClick}
            className="victorian-layout-mobile__nav-button"
          >
            Crediti
          </Button>
        </nav>
      </div>

      <main className={`victorian-layout-mobile__content victorian-layout-mobile__content--${pageClass}`}>
        <div className="victorian-layout-mobile__background-image-container">
          <img
            src={BACKGROUND_IMAGE_SRC}
            alt=""
            className="victorian-layout-mobile__background-image"
          />
          <div className="victorian-layout-mobile__title-container">
            <img
              src={LOGO_IMAGE_SRC}
              alt=""
              width={512}
              height={512}
              className="victorian-layout-mobile__logo"
            />
            <h2 className="victorian-layout-mobile__title">Chapter One</h2>
          </div>
        </div>
        <div className={`victorian-layout-mobile__page-info ${pageInfo ? 'active' : ''}`}>{pageInfo}</div>
        <div className="victorian-layout-mobile__page-content">{children}</div>
      </main>
    </div>
  );
};
