/**
 * Victorian Layout — Desktop
 *
 * Desktop-only layout: sidebar (logo + nav) + main area with background image and content.
 * Rendered when viewport width >= 1024px.
 *
 * @module components/VictorianLayoutDesktop
 */

import React from 'react';
import { Button } from './Button';

const BACKGROUND_IMAGE_SRC = '/images/sfondo.png';
const LOGO_IMAGE_SRC = '/images/title.png';

export interface VictorianLayoutDesktopProps {
  /** Page content rendered inside the main area. */
  children: React.ReactNode;
  /** When true, shows only "Chiudi" in the nav (info pages: credits, privacy, terms). */
  isInfoPage: boolean;
  /** Page identifier for main content (e.g. "login-page", "register-page"). */
  pageClass: string;
  /** Called for internal navigation (e.g. /register, /credits). */
  onNavigate: (path: string) => void;
  /** Called when "Documenti" is clicked (external link). */
  onDocsClick: () => void;
}

export const VictorianLayoutDesktop: React.FC<VictorianLayoutDesktopProps> = ({
  children,
  isInfoPage,
  pageClass,
  onNavigate,
  onDocsClick,
}) => {
  return (
    <div className="victorian-layout-desktop">
      <aside className="victorian-layout-desktop__sidebar">
        <img
          src={LOGO_IMAGE_SRC}
          alt="TenpennyNovels"
          className="victorian-layout-desktop__logo"
        />
        <nav className="victorian-layout-desktop__nav" aria-label="Navigazione principale">
          <h2 className="victorian-layout-desktop__nav-title">Chapter One</h2>

          {isInfoPage ? (
            <Button
              variant="ghost"
              onClick={() => window.close()}
              className="victorian-layout-desktop__nav-button"
            >
              Chiudi
            </Button>
          ) : (
            <>
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
                onClick={() => onNavigate('/credits')}
                className="victorian-layout-desktop__nav-button"
              >
                Crediti
              </Button>
            </>
          )}
        </nav>
      </aside>

      <main className={`victorian-layout-desktop__content victorian-layout-desktop__content--${pageClass}`}>
        <div className="victorian-layout-desktop__background-image">
          <img
            src={BACKGROUND_IMAGE_SRC}
            alt=""
            className=""
            fetchPriority="high"
          />
        </div>
        <div className="victorian-layout-desktop__page-content">{children}</div>
      </main>
    </div>
  );
};
