/**
 * WebSocket Context
 *
 * CRITICAL: Single point of reception for ALL WebSocket events.
 * Components subscribe to events via callback methods, never directly to socket.
 *
 * Architecture Pattern (from MEMORY.md):
 * Frontend → Backend → WebSocket → Frontend Components
 *    (API)      (Logic)   (Broadcast)   (Subscribe)
 *
 * Features:
 * - Single WebSocket connection
 * - Automatic reconnection with exponential backoff
 * - Keepalive ping/pong
 * - Event subscription/unsubscription
 * - Connection state management
 *
 * @module contexts/WebSocketContext
 * @since 2.0.0
 */

'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { WS_CONFIG } from '@/constants/config';
import { useAuthStore } from '@/store/authStore';

/**
 * WebSocket Connection Status
 *
 * @typedef {'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'} ConnectionStatus
 * @since 2.0.0
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

/**
 * Location Event Types
 *
 * @typedef {Object} LocationEvent
 * @property {string} type - Event type
 * @property {any} data - Event data (varies by type)
 *
 * @since 2.0.0
 */
export interface LocationEvent {
  type: string;
  data: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Global Event Types (Presence, Status, etc.)
 *
 * @typedef {Object} GlobalEvent
 * @property {string} type - Event type
 * @property {any} data - Event data (varies by type)
 *
 * @since 2.0.0
 */
export interface GlobalEvent {
  type: string;
  data: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Message Event Types (OffGame, Postal, etc.)
 *
 * @typedef {Object} MessageEvent
 * @property {string} type - Event type
 * @property {any} data - Event data (varies by type)
 *
 * @since 2.0.0
 */
export interface MessageEvent {
  type: string;
  data: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Event Callback Type
 *
 * @typedef {(event: T) => void} EventCallback
 * @template T
 * @since 2.0.0
 */
type EventCallback<T> = (event: T) => void;

/**
 * WebSocket Context Value
 *
 * @interface WebSocketContextValue
 * @since 2.0.0
 */
interface WebSocketContextValue {
  /** WebSocket connection status */
  status: ConnectionStatus;

  /** Whether WebSocket is connected */
  isConnected: boolean;

  /** WebSocket instance (AVOID direct use - prefer subscription methods) */
  socket: Socket | null;

  /**
   * Subscribe to location events
   *
   * @param {EventCallback<LocationEvent>} callback - Event handler
   * @returns {() => void} Unsubscribe function
   */
  onLocationEvent: (callback: EventCallback<LocationEvent>) => () => void;

  /**
   * Subscribe to global events
   *
   * @param {EventCallback<GlobalEvent>} callback - Event handler
   * @returns {() => void} Unsubscribe function
   */
  onGlobalEvent: (callback: EventCallback<GlobalEvent>) => () => void;

  /**
   * Subscribe to message events
   *
   * @param {EventCallback<MessageEvent>} callback - Event handler
   * @returns {() => void} Unsubscribe function
   */
  onMessageEvent: (callback: EventCallback<MessageEvent>) => () => void;

  /**
   * Manually reconnect WebSocket
   *
   * @returns {void}
   */
  reconnect: () => void;

  /**
   * Manually disconnect WebSocket
   *
   * @returns {void}
   */
  disconnect: () => void;
}

/**
 * WebSocket Context
 *
 * @constant
 * @since 2.0.0
 */
const WebSocketContext = createContext<WebSocketContextValue | null>(null);

/**
 * WebSocket Provider Props
 *
 * @interface WebSocketProviderProps
 * @since 2.0.0
 */
interface WebSocketProviderProps {
  children: ReactNode;
}

/**
 * WebSocket Provider Component
 *
 * Provides WebSocket connection and event subscription to entire application.
 * MUST be placed below AuthProvider in component tree.
 *
 * @component
 * @param {WebSocketProviderProps} props - Component props
 * @returns {JSX.Element}
 * @since 2.0.0
 *
 * @example
 * ```tsx
 * <AuthProvider>
 *   <WebSocketProvider>
 *     <App />
 *   </WebSocketProvider>
 * </AuthProvider>
 * ```
 */
export function WebSocketProvider({ children }: WebSocketProviderProps): JSX.Element {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Event callback storage
  const locationCallbacksRef = useRef<Set<EventCallback<LocationEvent>>>(new Set());
  const globalCallbacksRef = useRef<Set<EventCallback<GlobalEvent>>>(new Set());
  const messageCallbacksRef = useRef<Set<EventCallback<MessageEvent>>>(new Set());

  // Auth state
  const { isAuthenticated, selectedCharacter } = useAuthStore();

  /**
   * Initialize WebSocket Connection
   *
   * Creates Socket.IO connection with auth token and character ID.
   * Sets up all event listeners.
   *
   * @function initializeSocket
   * @returns {void}
   * @since 2.0.0
   */
  const initializeSocket = useCallback(() => {
    // Only connect if authenticated and character selected
    if (!isAuthenticated || !selectedCharacter) {
      return;
    }

    // Close existing connection
    if (socketRef.current) {
      socketRef.current.close();
    }

    setStatus('connecting');

    // Create Socket.IO connection
    const socket = io(WS_CONFIG.URL, {
      auth: {
        characterId: selectedCharacter._id,
      },
      withCredentials: true, // CRITICAL: Send HTTP-only cookies for authentication
      reconnection: true,
      reconnectionAttempts: WS_CONFIG.MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: WS_CONFIG.RECONNECT_INTERVAL,
      timeout: 10000,
    });

    socketRef.current = socket;

    /**
     * Connection Event Handlers
     */

    socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      setStatus('connected');
      reconnectAttemptsRef.current = 0;
    });

    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      setStatus('disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);

      // Exponential backoff reconnection
      reconnectAttemptsRef.current += 1;

      if (reconnectAttemptsRef.current < WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
        // Still have retry attempts - show reconnecting (loading), NOT error
        setStatus('reconnecting');

        const delay = Math.min(
          WS_CONFIG.RECONNECT_INTERVAL * Math.pow(2, reconnectAttemptsRef.current),
          30000
        );

        console.log(`[WebSocket] Retrying connection in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${WS_CONFIG.MAX_RECONNECT_ATTEMPTS})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          socket.connect();
        }, delay);
      } else {
        // All retry attempts exhausted - NOW show error
        console.error('[WebSocket] Max reconnection attempts reached');
        setStatus('error');
      }
    });

    /**
     * Location Events
     *
     * All location-related events are received here and distributed to subscribers.
     */

    socket.on('location_message_notification', (data) => {
      locationCallbacksRef.current.forEach((callback) =>
        callback({ type: 'location_message_notification', data })
      );
    });

    socket.on('player_entered', (data) => {
      locationCallbacksRef.current.forEach((callback) =>
        callback({ type: 'player_entered', data })
      );
    });

    socket.on('player_left', (data) => {
      locationCallbacksRef.current.forEach((callback) =>
        callback({ type: 'player_left', data })
      );
    });

    socket.on('user_typing', (data) => {
      locationCallbacksRef.current.forEach((callback) =>
        callback({ type: 'user_typing', data })
      );
    });

    socket.on('location_joined', (data) => {
      locationCallbacksRef.current.forEach((callback) =>
        callback({ type: 'location_joined', data })
      );
    });

    /**
     * Global Events (Presence, Status)
     */

    socket.on('global_presence_update', (data) => {
      globalCallbacksRef.current.forEach((callback) =>
        callback({ type: 'global_presence_update', data })
      );
    });

    socket.on('user_status_change', (data) => {
      globalCallbacksRef.current.forEach((callback) =>
        callback({ type: 'user_status_change', data })
      );
    });

    /**
     * Message Events (OffGame, Postal)
     */

    socket.on('offgame_message_received', (data) => {
      messageCallbacksRef.current.forEach((callback) =>
        callback({ type: 'offgame_message_received', data })
      );
    });

    socket.on('offgame_typing_indicator', (data) => {
      messageCallbacksRef.current.forEach((callback) =>
        callback({ type: 'offgame_typing_indicator', data })
      );
    });

    socket.on('offgame_message_read', (data) => {
      messageCallbacksRef.current.forEach((callback) =>
        callback({ type: 'offgame_message_read', data })
      );
    });

    socket.on('offgame_chat_updated', (data) => {
      messageCallbacksRef.current.forEach((callback) =>
        callback({ type: 'offgame_chat_updated', data })
      );
    });

    socket.on('ongame:message_delivered', (data) => {
      messageCallbacksRef.current.forEach((callback) =>
        callback({ type: 'ongame:message_delivered', data })
      );
    });

    socket.on('ongame:message_sent', (data) => {
      messageCallbacksRef.current.forEach((callback) =>
        callback({ type: 'ongame:message_sent', data })
      );
    });

    socket.on('ongame:message_read', (data) => {
      messageCallbacksRef.current.forEach((callback) =>
        callback({ type: 'ongame:message_read', data })
      );
    });

    socket.on('character_status_changed', (data) => {
      messageCallbacksRef.current.forEach((callback) =>
        callback({ type: 'character_status_changed', data })
      );
    });

    /**
     * Keepalive Ping
     */

    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping');
      }
    }, WS_CONFIG.PING_INTERVAL);

    // Cleanup
    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      socket.close();
    };
  }, [isAuthenticated, selectedCharacter]);

  /**
   * Initialize socket on mount and auth changes
   */
  useEffect(() => {
    const cleanup = initializeSocket();
    return () => {
      if (cleanup) cleanup();
    };
  }, [initializeSocket]);

  /**
   * Subscribe to location events
   *
   * @function onLocationEvent
   * @param {EventCallback<LocationEvent>} callback - Event handler
   * @returns {() => void} Unsubscribe function
   * @since 2.0.0
   */
  const onLocationEvent = useCallback((callback: EventCallback<LocationEvent>) => {
    locationCallbacksRef.current.add(callback);
    return () => {
      locationCallbacksRef.current.delete(callback);
    };
  }, []);

  /**
   * Subscribe to global events
   *
   * @function onGlobalEvent
   * @param {EventCallback<GlobalEvent>} callback - Event handler
   * @returns {() => void} Unsubscribe function
   * @since 2.0.0
   */
  const onGlobalEvent = useCallback((callback: EventCallback<GlobalEvent>) => {
    globalCallbacksRef.current.add(callback);
    return () => {
      globalCallbacksRef.current.delete(callback);
    };
  }, []);

  /**
   * Subscribe to message events
   *
   * @function onMessageEvent
   * @param {EventCallback<MessageEvent>} callback - Event handler
   * @returns {() => void} Unsubscribe function
   * @since 2.0.0
   */
  const onMessageEvent = useCallback((callback: EventCallback<MessageEvent>) => {
    messageCallbacksRef.current.add(callback);
    return () => {
      messageCallbacksRef.current.delete(callback);
    };
  }, []);

  /**
   * Manually reconnect WebSocket
   *
   * @function reconnect
   * @returns {void}
   * @since 2.0.0
   */
  const reconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.connect();
    } else {
      initializeSocket();
    }
  }, [initializeSocket]);

  /**
   * Manually disconnect WebSocket
   *
   * @function disconnect
   * @returns {void}
   * @since 2.0.0
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
    }
  }, []);

  const value: WebSocketContextValue = {
    status,
    isConnected: status === 'connected',
    socket: socketRef.current,
    onLocationEvent,
    onGlobalEvent,
    onMessageEvent,
    reconnect,
    disconnect,
  };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

/**
 * useWebSocket Hook
 *
 * Access WebSocket context from any component.
 * MUST be used within WebSocketProvider.
 *
 * @function useWebSocket
 * @returns {WebSocketContextValue} WebSocket context value
 * @throws {Error} If used outside WebSocketProvider
 * @since 2.0.0
 *
 * @example
 * ```tsx
 * function LocationChat() {
 *   const { onLocationEvent, isConnected } = useWebSocket();
 *
 *   useEffect(() => {
 *     const unsubscribe = onLocationEvent((event) => {
 *       if (event.type === 'location_message_notification') {
 *         console.log('New message:', event.data);
 *       }
 *     });
 *
 *     return unsubscribe;
 *   }, [onLocationEvent]);
 *
 *   return <div>Connected: {isConnected ? 'Yes' : 'No'}</div>;
 * }
 * ```
 */
export function useWebSocket(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
}
