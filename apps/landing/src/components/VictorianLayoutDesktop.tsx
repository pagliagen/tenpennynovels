/**
 * Victorian Layout — Desktop
 *
 * Desktop-only layout: sidebar (logo + nav) + main area with background image and content.
 * Rendered when viewport width >= 1024px.
 *
 * @module components/VictorianLayoutDesktop
 */

import React from 'react';
import Image from 'next/image';
import { Button } from './Button';

const LOGO_IMAGE_SRC = '/images/title.png';

export interface VictorianLayoutDesktopProps {
  /** Page content rendered inside the main area. */
  children: React.ReactNode;
  /** When true, shows only "Chiudi" in the nav (info pages: credits). */
  isInfoPage: boolean;
  /** Page identifier for main content (e.g. "login-page", "register-page"). */
  pageClass: string;
  /** Called for internal navigation (e.g. /register). */
  onNavigate: (path: string) => void;
  /** Called when "Documenti" is clicked (external link). */
  onDocsClick: () => void;
  /** Called when "Crediti" is clicked (opens modal). */
  onCreditsClick: () => void;
  /** Optional info panel rendered above page content */
  pageInfo?: React.ReactNode;
}

export const VictorianLayoutDesktop: React.FC<VictorianLayoutDesktopProps> = ({
  children,
  isInfoPage,
  pageClass,
  onNavigate,
  onDocsClick,
  onCreditsClick,
  pageInfo,
}) => {
  return (
    <div className="victorian-layout-desktop">
      <aside className="victorian-layout-desktop__sidebar">
        <div className="victorian-layout-desktop__logo-container">
          <Image
            src={LOGO_IMAGE_SRC}
            alt="Ten Penny Novels"
            className="victorian-layout-desktop__logo"
            width={512}
            height={512}
            priority
          />
        </div>
        <nav className="victorian-layout-desktop__nav" aria-label="Navigazione principale">
          <h2 className="victorian-layout-desktop__nav-title">Chapter One</h2>

          {isInfoPage && (
            <Button
              variant="ghost"
              onClick={() => onNavigate('/')}
              className="victorian-layout-desktop__nav-button"
            >
              Torna al Login
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={() => onNavigate('/register')}
            className="victorian-layout-desktop__nav-button"
          >
            Registrati
          </Button>
          <Button
            variant="ghost"
            onClick={onDocsClick}
            className="victorian-layout-desktop__nav-button"
          >
            Documenti
          </Button>
          <Button
            variant="ghost"
            onClick={onCreditsClick}
            className="victorian-layout-desktop__nav-button"
          >
            Crediti
          </Button>
        </nav>
      </aside>

      <main className={`victorian-layout-desktop__content victorian-layout-desktop__content--${pageClass}`}>
        <div className="victorian-layout-desktop__background-image"></div>
        <div className="victorian-layout-desktop__page-content">
          <div className={`victorian-layout-desktop__page-info ${pageInfo ? 'active' : ''}`}>
            <div className="victorian-layout-desktop__page-info-content">{pageInfo}</div>
          </div>
          <div className="victorian-layout-desktop__page-form">{children}</div>
        </div>
      </main>
    </div>
  );
};
