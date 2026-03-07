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

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { GameLayout } from '@/components/layout/GameLayout';
import { useAuthStore } from '@/store/authStore';
import { useWebSocket } from '@/contexts/WebSocketContext';

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

  return (
    <>
      <Head>
        <title>Ten Penny Novels - Gioco di Ruolo Vittoriano Online</title>
        <meta name="description" content="Gioca a Ten Penny Novels, GDR online ambientato nella Londra Vittoriana del 1890. Sistema Call of Cthulhu con narrazione investigativa in tempo reale." />
      </Head>
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: rotate(0deg);
          }
          50% {
            opacity: 0.5;
            transform: rotate(180deg);
          }
        }
      `}</style>
      <GameLayout>
      <div
        style={{
          padding: '2rem',
          fontFamily: 'Merriweather, serif',
        }}
      >
        <h1
          style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: '2.5rem',
            marginBottom: '1rem',
            color: '#8B4513',
          }}
        >
          Welcome to Ten Penny Novels
        </h1>

        <p style={{ fontSize: '1.1rem', marginBottom: '2rem', color: '#333' }}>
          Victorian Gothic Interactive Fiction
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1.5rem',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
          }}
        >
          <div>
            <strong>Authentication:</strong>{' '}
            <span style={{ color: isAuthenticated ? 'green' : 'red' }}>
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
            <span
              style={{
                color:
                  status === 'connected'
                    ? 'green'
                    : status === 'connecting' || status === 'reconnecting'
                    ? 'orange'
                    : status === 'disconnected'
                    ? '#666'
                    : 'red', // error
              }}
            >
              {status === 'connecting' || status === 'reconnecting' ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }}>
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
          <div
            style={{
              marginTop: '2rem',
              padding: '1.5rem',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
              border: '1px solid #ddd',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#8B4513' }}>
              📡 WebSocket Events (Live Feed)
            </h3>

            {events.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>
                No events received yet. Waiting for WebSocket events...
              </p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  maxHeight: '300px',
                  overflowY: 'auto',
                }}
              >
                {events.map((event, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: '#fff',
                      borderRadius: '4px',
                      border: '1px solid #e0e0e0',
                      fontSize: '0.9rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <strong style={{ color: '#2c5282' }}>{event.type}</strong>
                      <span style={{ color: '#999', fontSize: '0.85rem' }}>{event.time}</span>
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        fontSize: '0.8rem',
                        color: '#555',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        backgroundColor: '#f5f5f5',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        maxHeight: '100px',
                        overflowY: 'auto',
                      }}
                    >
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
