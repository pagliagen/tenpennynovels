import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Button } from '@/components/Button';

interface VictorianLayoutProps {
  children: React.ReactNode;
  subtitle?: string;
}

export const VictorianLayout: React.FC<VictorianLayoutProps> = ({ 
  children, 
  subtitle = "Chapter One" 
}) => {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="newLayout">
      {/* Background image */}
      <div className="backgroundImage"></div>
      
      {/* Mobile background */}
      <div className="mobileBackground"></div>
      
      {/* Hamburger Menu */}
      <div className={`hamburgerMenu ${isMobileMenuOpen ? 'open' : ''}`} onClick={toggleMobileMenu}>
        <div className="hamburgerIcon">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
      
      {/* Mobile Navigation Overlay */}
      <div className={`mobileNavOverlay ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="mobileNavContent">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              router.push('/register');
              setIsMobileMenuOpen(false);
            }}
            className="sideNavButton"
          >
            Registrati
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              window.location.href = process.env.NEXT_PUBLIC_DOCS_URL || 'https://documenti.tenpennynovels.com';
              setIsMobileMenuOpen(false);
            }}
            className="sideNavButton"
          >
            Documenti
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              router.push('/credits');
              setIsMobileMenuOpen(false);
            }}
            className="sideNavButton"
          >
            Crediti
          </Button>
        </div>
      </div>
      
      {/* Left side - Logo and Navigation */}
      <div className="leftSide">
        <div className="logoSection"></div>
        
        <nav className="sideNav">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/register')}
            className="sideNavButton"
          >
            Registrati
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            onClick={() => window.location.href = process.env.NEXT_PUBLIC_DOCS_URL || 'https://documenti.tenpennynovels.com'}
            className="sideNavButton"
          >
            Documenti
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/credits')}
            className="sideNavButton"
          >
            Crediti
          </Button>
        </nav>
      </div>

      {/* Right side - Main content with window */}
      <div className="rightSide">
        <div className="windowFrame">
          {/* Raven silhouette will be in CSS background */}
          <div className="windowContent">
            {/* Content can be placed here for window display */}
          </div>
        </div>
        
        {/* Login form positioned over the window */}
        {children}
      </div>
    </div>
  );
};