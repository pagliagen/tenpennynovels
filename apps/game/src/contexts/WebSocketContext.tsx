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
import { playNotificationSound } from '@/lib/audio';
import { wsClient } from '@/lib/websocket/client';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';

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
  data: any;  
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
  data: any;  
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
  data: any;  
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

  /** Current location ID (for cross-location notification filtering) */
  currentLocationId: string | null;

  /**
   * Set current location ID
   *
   * @param {string | null} locationId - Current location ID or null
   * @returns {void}
   */
  setCurrentLocationId: (locationId: string | null) => void;

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
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null);
  const currentLocationIdRef = useRef<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Event callback storage
  const locationCallbacksRef = useRef<Set<EventCallback<LocationEvent>>>(new Set());
  const globalCallbacksRef = useRef<Set<EventCallback<GlobalEvent>>>(new Set());
  const messageCallbacksRef = useRef<Set<EventCallback<MessageEvent>>>(new Set());

  // Sincronizza il ref con lo state per evitare stale closure nei callback WebSocket
  currentLocationIdRef.current = currentLocationId;

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

    // NEW FLOW: Read sessionId from sessionStorage (multi-tab support)
    const sessionId = sessionStorage.getItem('character_session_id');

    if (!sessionId) {
      console.error('[WebSocket] No sessionId found in sessionStorage - cannot connect');
      setStatus('error');
      return;
    }

    // Create Socket.IO connection
    const socket = io(WS_CONFIG.URL, {
      auth: {
        sessionId: sessionId,  // NEW: Send sessionId (opaque UUID) for multi-tab support
        characterId: selectedCharacter._id, // DEPRECATED: Kept for backward compatibility
      },
      withCredentials: true, // CRITICAL: Send HTTP-only cookies (auth_token) for user authentication
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

      // Register socket in singleton for use in stores
      wsClient.setSocket(socket);

      // Trigger presence refetch after reconnect (catch up on missed events)
      socket.emit('request_presence_sync');
    });

    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      setStatus('disconnected');

      // Deregister socket from singleton
      wsClient.setSocket(null);
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
      // Handle cross-location notifications (toast + audio for messages in other locations)
      if (data.locationId && currentLocationIdRef.current && data.locationId !== currentLocationIdRef.current) {
        const message = data.message;
        const character = selectedCharacter;

        if (!message || !character) {
          // Skip if no message or character
          locationCallbacksRef.current.forEach((callback) =>
            callback({ type: 'location_message_notification', data })
          );
          return;
        }

        // Determine if character should see this message based on visibility
        let shouldNotify = false;
        let toastMessage = '';

        if (message.visibility === 'whisper') {
          // Only notify if character is sender or target
          if (message.characterId === character._id || message.targetCharacters?.includes(character._id)) {
            shouldNotify = true;
            toastMessage = `Sussurro da ${message.characterName} in ${data.locationName || 'altra location'}`;
          }
        } else if (message.visibility === 'master_only') {
          // IMPORTANT: Backend already filters who receives this WebSocket event.
          // If we received it, we have permission to see it. Don't re-check roles here.
          // Permissions are the single source of truth - enforced by backend.
          shouldNotify = true;
          toastMessage = `[Master] ${message.characterName} in ${data.locationName || 'altra chat'}`;
        } else if (message.visibility === 'public') {
          // Public message - notify everyone
          shouldNotify = true;
          toastMessage = `${message.characterName} ha scritto in ${data.locationName || 'altra chat'}`;
        }

        if (shouldNotify) {
          // Play audio notification
          playNotificationSound();

          // Show clickable toast that navigates to the location chat
          useUIStore.getState().addToast({
            type: 'info',
            message: toastMessage,
            duration: 6000,
            onClick: () => {
              // Navigation will be handled by ToastContainer which has access to router
              if (typeof window !== 'undefined' && data.locationSlug) {
                window.location.href = `/locations/${data.locationSlug}/chat`;
              } else if (typeof window !== 'undefined' && data.locationId) {
                window.location.href = `/locations/${data.locationId}/chat`;
              }
            },
          });
        }
      }

      // Always dispatch to component subscribers (for in-chat handling)
      locationCallbacksRef.current.forEach((callback) =>
        callback({ type: 'location_message_notification', data })
      );
    });

    socket.on('location_action_deleted', (data) => {
      // Dispatch delete event to location subscribers
      locationCallbacksRef.current.forEach((callback) =>
        callback({ type: 'location_action_deleted', data })
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

    socket.on('character_active', (data) => {
      globalCallbacksRef.current.forEach((callback) =>
        callback({ type: 'character_active', data })
      );
    });

    socket.on('character_inactive', (data) => {
      globalCallbacksRef.current.forEach((callback) =>
        callback({ type: 'character_inactive', data })
      );
    });

    socket.on('character_ban_updated', (data) => {
      globalCallbacksRef.current.forEach((callback) =>
        callback({ type: 'character_ban_updated', data })
      );
    });

    /**
     * Message Events (OffGame, Postal)
     */

    socket.on('offgame_message_received', (data) => {
      messageCallbacksRef.current.forEach((callback) =>
        callback({ type: 'offgame_message_received', data })
      );

      if (data?.senderName) {
        useUIStore.getState().addToast({
          type: 'info',
          message: `Nuovo messaggio da ${data.senderName}`,
          duration: 4000,
        });
      }
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

      if (data?.fromCharacterName) {
        useUIStore.getState().addToast({
          type: 'info',
          message: `Nuova posta da ${data.fromCharacterName}${data.subject ? `: ${data.subject}` : ''}`,
          duration: 4000,
        });
      }
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

      if (data?.message) {
        const toastType = data.action === 'approve' ? 'success' : 'warning';
        useUIStore.getState().addToast({
          type: toastType,
          message: data.message,
          duration: 6000,
        });
      }
    });

    /**
     * Notification Events
     *
     * Direct toast triggers - these events are NOT dispatched to component callbacks,
     * they only produce user-visible toast notifications.
     */

    socket.on('notification:ticket', (data) => {
      useUIStore.getState().addToast({
        type: 'info',
        message: data?.title || data?.message || 'Nuova notifica ticket',
        duration: 5000,
      });
    });

    /**
     * Ticket Events (for real-time ticket updates)
     */

    socket.on('ticket:staff_replied', (data) => {
      // Play notification sound
      playNotificationSound();

      // Show toast
      useUIStore.getState().addToast({
        type: 'info',
        message: `Nuova risposta al ticket #${data.ticketNumber || data.ticketId}`,
        duration: 5000,
      });

      // Distribute to message subscribers (for query invalidation)
      messageCallbacksRef.current.forEach((callback) =>
        callback({ type: 'ticket:staff_replied', data })
      );
    });

    socket.on('ticket:status_changed', (data) => {
      const statusLabels: Record<string, string> = {
        assigned: 'preso in carico',
        in_progress: 'in lavorazione',
        waiting_user: 'in attesa di risposta',
        resolved: 'risolto',
        closed: 'chiuso'
      };

      const statusLabel = statusLabels[data.newStatus] || data.newStatus;

      useUIStore.getState().addToast({
        type: data.newStatus === 'resolved' ? 'success' : 'info',
        message: `Ticket #${data.ticketNumber || data.ticketId} ${statusLabel}`,
        duration: 5000,
      });

      // Distribute to message subscribers
      messageCallbacksRef.current.forEach((callback) =>
        callback({ type: 'ticket:status_changed', data })
      );
    });

    socket.on('ticket:closed', (data) => {
      useUIStore.getState().addToast({
        type: 'info',
        message: `Ticket #${data.ticketNumber || data.ticketId} chiuso`,
        duration: 5000,
      });

      // Distribute to message subscribers
      messageCallbacksRef.current.forEach((callback) =>
        callback({ type: 'ticket:closed', data })
      );
    });

    socket.on('system_notification', (message) => {
      useUIStore.getState().addToast({
        type: 'info',
        message: typeof message === 'string' ? message : 'Notifica di sistema',
        duration: 5000,
      });
    });

    socket.on('error', (errorMsg) => {
      useUIStore.getState().addToast({
        type: 'error',
        message: typeof errorMsg === 'string' ? errorMsg : 'Si è verificato un errore',
        duration: 5000,
      });
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
    currentLocationId,
    setCurrentLocationId,
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
