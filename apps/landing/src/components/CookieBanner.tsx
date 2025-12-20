import React, { useState, useEffect } from 'react';
import styles from '@/styles/components/CookieBanner.module.scss';

const COOKIE_BANNER_KEY = 'tpn_cookie_consent';

export const CookieBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    const consent = localStorage.getItem(COOKIE_BANNER_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_BANNER_KEY, 'accepted');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className={styles.cookieBanner}>
      <div className={styles.bannerContent}>
        <div className={styles.bannerText}>
          <h4 className={styles.bannerTitle}>🍪 Cookie & Privacy</h4>
          <p className={styles.bannerDescription}>
            Questo sito utilizza <strong>cookie essenziali</strong> per il funzionamento
            dell'autenticazione e della gestione delle sessioni di gioco.
            Non utilizziamo cookie di tracciamento pubblicitario.
          </p>
        </div>
        <div className={styles.bannerActions}>
          <button onClick={handleAccept} className={styles.acceptButton}>
            Accetto
          </button>
          <a href="/privacy" target="_blank" className={styles.privacyLink}>
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
};
