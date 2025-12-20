import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import styles from './WebSocketDebugPanel.module.scss';

interface DebugMessage {
  id: string;
  timestamp: string;
  type: 'OUTGOING' | 'INCOMING' | 'CONNECTION' | 'ERROR';
  event: string;
  data?: any;
}

export const WebSocketDebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DebugMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { 
    isConnected, 
    connectionError, 
    currentCharacterId, 
    currentLocationId,
    onLocationAction,
    onPresenceUpdate,
    onLocationEvent,
    onTypingUpdate,
    sendLocationAction: originalSendLocationAction,
    joinLocation: originalJoinLocation,
    startTyping: originalStartTyping,
    stopTyping: originalStopTyping
  } = useWebSocket();

  // Add debug message
  const addDebugMessage = (type: DebugMessage['type'], event: string, data?: any) => {
    const message: DebugMessage = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      event,
      data
    };
    
    setMessages(prev => [...prev.slice(-99), message]); // Keep last 100 messages
  };

  // Monitor WebSocket events
  useEffect(() => {
    addDebugMessage('CONNECTION', isConnected ? 'CONNECTED' : 'DISCONNECTED');
  }, [isConnected]);

  useEffect(() => {
    if (connectionError) {
      addDebugMessage('ERROR', 'CONNECTION_ERROR', { error: connectionError });
    }
  }, [connectionError]);

  // Subscribe to all WebSocket events for debugging
  useEffect(() => {
    const unsubscribeLocation = onLocationAction((action) => {
      addDebugMessage('INCOMING', 'location_action', action);
    });

    const unsubscribePresence = onPresenceUpdate((update) => {
      addDebugMessage('INCOMING', 'user_status_change', update);
    });

    const unsubscribeLocationEvent = onLocationEvent((event) => {
      addDebugMessage('INCOMING', `player_${event.type}`, event);
    });

    const unsubscribeTyping = onTypingUpdate((data) => {
      addDebugMessage('INCOMING', 'user_typing', data);
    });

    // Listen for custom debug events from WebSocket context
    const handleDebugEvent = (event: CustomEvent) => {
      const { type, eventName, data } = event.detail;
      addDebugMessage(type, eventName, data);
    };

    window.addEventListener('websocket-debug' as any, handleDebugEvent);

    return () => {
      unsubscribeLocation();
      unsubscribePresence();
      unsubscribeLocationEvent();
      unsubscribeTyping();
      window.removeEventListener('websocket-debug' as any, handleDebugEvent);
    };
  }, [onLocationAction, onPresenceUpdate, onLocationEvent, onTypingUpdate]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const getMessageTypeClass = (type: DebugMessage['type']) => {
    switch (type) {
      case 'OUTGOING': return styles.outgoing;
      case 'INCOMING': return styles.incoming;
      case 'CONNECTION': return styles.connection;
      case 'ERROR': return styles.error;
      default: return '';
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <>
      {/* Toggle Button */}
      <div className={styles.toggleButton}>
        <button onClick={() => setIsOpen(!isOpen)} title="WebSocket Debug Panel">
          🔌 {isConnected ? '🟢' : '🔴'}
        </button>
      </div>

      {/* Debug Panel */}
      {isOpen && (
        <div className={styles.debugPanel}>
          <div className={styles.header}>
            <h3>WebSocket Debug</h3>
            <div className={styles.controls}>
              <button onClick={clearMessages} className={styles.clearBtn}>Clear</button>
              <button onClick={() => setIsOpen(false)} className={styles.closeBtn}>✕</button>
            </div>
          </div>

          <div className={styles.status}>
            <div className={styles.statusRow}>
              <span>Status:</span>
              <span className={`${styles.statusValue} ${isConnected ? styles.connected : styles.disconnected}`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className={styles.statusRow}>
              <span>Character:</span>
              <span className={styles.statusValue}>{currentCharacterId || 'None'}</span>
            </div>
            <div className={styles.statusRow}>
              <span>Location:</span>
              <span className={styles.statusValue}>{currentLocationId || 'None'}</span>
            </div>
            {connectionError && (
              <div className={styles.statusRow}>
                <span>Error:</span>
                <span className={`${styles.statusValue} ${styles.error}`}>{connectionError}</span>
              </div>
            )}
          </div>

          <div className={styles.messagesContainer}>
            {messages.map((message) => (
              <div key={message.id} className={`${styles.message} ${getMessageTypeClass(message.type)}`}>
                <div className={styles.messageHeader}>
                  <span className={styles.timestamp}>{message.timestamp}</span>
                  <span className={styles.type}>{message.type}</span>
                  <span className={styles.event}>{message.event}</span>
                </div>
                {message.data && (
                  <div className={styles.messageData}>
                    <pre>{JSON.stringify(message.data, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}
    </>
  );
};

export default WebSocketDebugPanel;