/**
 * Home Page
 *
 * Landing page for authenticated users.
 * Shows game layout with placeholder content.
 *
 * @module pages/index
 * @since 2.0.0
 */

'use client';

import Head from 'next/head';
import { useState, useEffect } from 'react';
import classNames from 'classnames';

import { GameLayout } from '@/components/layout/GameLayout';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useAuthStore } from '@/store/authStore';
import styles from '@/styles/pages/HomePage.module.scss';

/**
 * Home Page Component
 *
 * Entry point for the application.
 * Renders game layout with status information.
 *
 * @component
 * @returns {JSX.Element} Home page content
 * @since 2.0.0
 */
export default function HomePage(): JSX.Element {
  const { user, selectedCharacter, isAuthenticated } = useAuthStore();
  const { status, isConnected, onLocationEvent, onGlobalEvent, onMessageEvent } = useWebSocket();
  const [events, setEvents] = useState<Array<{ time: string; type: string; data: any }>>([]);

  // Subscribe to all WebSocket events to display them
  useEffect(() => {
    if (!isConnected) return;

    const addEvent = (type: string, data: any) => {
      const time = new Date().toLocaleTimeString();
      setEvents((prev) => [{ time, type, data }, ...prev].slice(0, 10)); // Keep last 10 events
    };

    // Subscribe to location events
    const unsubLocation = onLocationEvent((event) => {
      addEvent(event.type, event.data);
    });

    // Subscribe to global events
    const unsubGlobal = onGlobalEvent((event) => {
      addEvent(event.type, event.data);
    });

    // Subscribe to message events
    const unsubMessage = onMessageEvent((event) => {
      addEvent(event.type, event.data);
    });

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
    <>
      <Head>
        <title>Ten Penny Novels | Gioco di Ruolo Vittoriano Online</title>
        <meta name="description" content="Gioca a Ten Penny Novels, GDR online ambientato nella Londra Vittoriana del 1890. Sistema Call of Cthulhu con narrazione investigativa in tempo reale." />
      </Head>
      <GameLayout>
      <div className={styles.root}>
        <h1 className={styles.title}>
          Welcome to Ten Penny Novels
        </h1>

        <p className={styles.tagline}>
          Victorian Gothic Interactive Fiction
        </p>

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
                  <span className={styles.spinner}>
                    ⟳
                  </span>{' '}
                  {status.charAt(0).toUpperCase() + status.slice(1)}...
                </>
              ) : (
                status.charAt(0).toUpperCase() + status.slice(1)
              )}
            </span>
          </div>
        </div>

        {/* WebSocket Event Feed - Live Events Display */}
        {isConnected && (
          <div className={styles.feedSection}>
            <h3 className={styles.feedTitle}>
              📡 WebSocket Events (Live Feed)
            </h3>

            {events.length === 0 ? (
              <p className={styles.feedEmpty}>
                No events received yet. Waiting for WebSocket events...
              </p>
            ) : (
              <div className={styles.feedList}>
                {events.map((event, index) => (
                  <div
                    key={index}
                    className={styles.eventCard}
                  >
                    <div className={styles.eventHeader}>
                      <strong className={styles.eventType}>{event.type}</strong>
                      <span className={styles.eventTime}>{event.time}</span>
                    </div>
                    <pre className={styles.eventPre}>
                      {JSON.stringify(event.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </GameLayout>
    </>
  );
}
