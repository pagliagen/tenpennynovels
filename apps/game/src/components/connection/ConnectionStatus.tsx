/**
 * Connection Status Overlay
 *
 * Mostra overlay carino quando WebSocket è disconnesso/reconnecting.
 * Auto-hide quando connessione è ristabilita.
 *
 * @module components/connection/ConnectionStatus
 * @since 2.0.0
 */

'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import styles from '@/styles/components/connection/ConnectionStatus.module.scss';

/**
 * Connection Status Overlay Component
 *
 * @component
 * @returns {JSX.Element | null} Overlay or null if connected
 * @since 2.0.0
 */
export function ConnectionStatus(): JSX.Element | null {
  const { status, reconnect } = useWebSocket();
  const [showOverlay, setShowOverlay] = useState(false);
  const [wasConnected, setWasConnected] = useState(false);

  useEffect(() => {
    // Track if we've ever been connected
    if (status === 'connected') {
      setWasConnected(true);
      setShowOverlay(false);
    }

    // Only show overlay if we were previously connected and now lost connection
    // Don't show on initial connecting state
    if (wasConnected && (status === 'disconnected' || status === 'reconnecting' || status === 'error')) {
      setShowOverlay(true);
    }
  }, [status, wasConnected]);

  // Don't render if not showing overlay
  if (!showOverlay) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        {/* Animated Icon */}
        <div className={styles.iconContainer}>
          {status === 'reconnecting' ? (
            <div className={styles.spinner}>
              <div className={styles.spinnerRing}></div>
              <div className={styles.spinnerRing}></div>
              <div className={styles.spinnerRing}></div>
            </div>
          ) : status === 'error' ? (
            <div className={styles.errorIcon}>⚠️</div>
          ) : (
            <div className={styles.disconnectedIcon}>🔌</div>
          )}
        </div>

        {/* Status Message */}
        <div className={styles.message}>
          {status === 'reconnecting' && (
            <>
              <h2>Riconnessione in corso...</h2>
              <p>Attendere mentre ripristiniamo la connessione al server</p>
            </>
          )}

          {status === 'disconnected' && (
            <>
              <h2>Connessione interrotta</h2>
              <p>La connessione al server è stata persa</p>
            </>
          )}

          {status === 'error' && (
            <>
              <h2>Impossibile riconnettersi</h2>
              <p>Controlla la tua connessione internet e riprova</p>
            </>
          )}
        </div>

        {/* Action Buttons */}
        {(status === 'disconnected' || status === 'error') && (
          <div className={styles.actions}>
            <button onClick={reconnect} className={styles.retryButton}>
              🔄 Riprova
            </button>
            <button onClick={() => window.location.reload()} className={styles.reloadButton}>
              ↻ Ricarica Pagina
            </button>
          </div>
        )}

        {/* Pulsing Dots (for reconnecting state) */}
        {status === 'reconnecting' && (
          <div className={styles.dots}>
            <span className={styles.dot}></span>
            <span className={styles.dot}></span>
            <span className={styles.dot}></span>
          </div>
        )}
      </div>
    </div>
  );
}
