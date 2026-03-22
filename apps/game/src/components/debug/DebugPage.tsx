/**
 * Debug Page Component
 *
 * Contenuto visibile solo in development (NODE_ENV !== 'production').
 * Mostra stato auth, connessione WebSocket e live feed degli eventi socket.
 *
 * In production questo componente non viene renderizzato.
 *
 * @module components/debug/DebugPage
 */

'use client';

import { useEffect, useState } from 'react';
import classNames from 'classnames';

import { useWebSocket } from '@/contexts/WebSocketContext';
import { useAuthStore } from '@/store/authStore';
import styles from '@/styles/pages/HomePage.module.scss';

/**
 * DebugPage
 *
 * Pannello di debug per sviluppo locale: auth status, WS status, live event feed.
 */
export function DebugPage(): JSX.Element {
  const { user, selectedCharacter, isAuthenticated } = useAuthStore();
  const { status, isConnected, onLocationEvent, onGlobalEvent, onMessageEvent } = useWebSocket();
  const [events, setEvents] = useState<Array<{ time: string; type: string; data: unknown }>>([]);

  useEffect(() => {
    if (!isConnected) return;

    const addEvent = (type: string, data: unknown) => {
      const time = new Date().toLocaleTimeString();
      setEvents((prev) => [{ time, type, data }, ...prev].slice(0, 10));
    };

    const unsubLocation = onLocationEvent((event) => addEvent(event.type, event.data));
    const unsubGlobal = onGlobalEvent((event) => addEvent(event.type, event.data));
    const unsubMessage = onMessageEvent((event) => addEvent(event.type, event.data));

    return () => {
      unsubLocation();
      unsubGlobal();
      unsubMessage();
    };
  }, [isConnected, onLocationEvent, onGlobalEvent, onMessageEvent]);

  const wsStatusClass =
    status === 'connected'
      ? styles.statusWsConnected
      : status === 'connecting' || status === 'reconnecting'
        ? styles.statusWsConnecting
        : status === 'disconnected'
          ? styles.statusWsDisconnected
          : styles.statusWsError;

  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Welcome to Ten Penny Novels</h1>
      <p className={styles.tagline}>Victorian Gothic Interactive Fiction</p>

      <div className={styles.statusPanel}>
        <div>
          <strong>Authentication:</strong>{' '}
          <span className={isAuthenticated ? styles.statusOk : styles.statusBad}>
            {isAuthenticated ? '✓ Authenticated' : '✗ Not Authenticated'}
          </span>
        </div>

        {user && (
          <div>
            <strong>User:</strong> {user.username}
          </div>
        )}

        {selectedCharacter && (
          <div>
            <strong>Character:</strong> {selectedCharacter.name}
          </div>
        )}

        <div>
          <strong>WebSocket:</strong>{' '}
          <span className={classNames(styles.statusWs, wsStatusClass)}>
            {status === 'connecting' || status === 'reconnecting' ? (
              <>
                <span className={styles.spinner}>⟳</span>{' '}
                {status.charAt(0).toUpperCase() + status.slice(1)}...
              </>
            ) : (
              status.charAt(0).toUpperCase() + status.slice(1)
            )}
          </span>
        </div>
      </div>

      {isConnected && (
        <div className={styles.feedSection}>
          <h3 className={styles.feedTitle}>📡 WebSocket Events (Live Feed)</h3>

          {events.length === 0 ? (
            <p className={styles.feedEmpty}>No events received yet. Waiting for WebSocket events...</p>
          ) : (
            <div className={styles.feedList}>
              {events.map((event, index) => (
                <div key={index} className={styles.eventCard}>
                  <div className={styles.eventHeader}>
                    <strong className={styles.eventType}>{event.type}</strong>
                    <span className={styles.eventTime}>{event.time}</span>
                  </div>
                  <pre className={styles.eventPre}>{JSON.stringify(event.data, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
