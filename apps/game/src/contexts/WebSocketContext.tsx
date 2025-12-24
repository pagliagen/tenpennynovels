import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { io, Socket } from 'socket.io-client';

// Types for WebSocket events
export interface LocationAction {
  actionType: 'standard' | 'master' | 'moderation' | 'whisper' | 'ooc' | 'dice_roll' | 'skill_check' | 'stat_check' | 'item_use';
  characterId: string;
  characterName: string;
  characterSurname?: string;
  content: string;
  locationId: string;
  timestamp: string;
  visibility: 'public' | 'whisper' | 'master_only';
  
  // Dice roll results (for dice_roll, skill_check, stat_check)
  diceResult?: {
    dice: string;        // e.g., "1d100"
    result: number;      // actual roll result
    success?: boolean;   // only for skill/stat checks
    target?: number;     // target number for skill/stat checks
    skillName?: string;  // for skill checks
    statName?: string;   // for stat checks
  };
  
  // Item usage results
  itemEffect?: {
    itemId: string;
    itemName: string;
    description: string;
    consumedItems?: Array<{
      itemId: string;
      itemName: string;
      quantity: number;
    }>;
    effects?: Array<{
      type: string;
      value: number;
      duration?: string;
    }>;
  };
  
  targetCharacters?: string[];
  characterRoles: string[];
}

// WebSocket notification for new messages (not full content)
export interface LocationMessageNotification {
  locationId: string;
  actionId: string;
  characterName: string;
  actionType: string;
  timestamp: string;
}

export interface GlobalPresenceUpdate {
  type?: 'character_entered_location' | 'character_left_location';
  characterId: string;
  characterName: string;
  locationId: string;
  locationName?: string;
  status?: 'online' | 'offline';
  timestamp: string;
}

export interface LocationEvent {
  type: 'player_entered' | 'player_left';
  characterId: string;
  characterName: string;
  locationId: string;
  timestamp: string;
}

export interface LocationJoinedEvent {
  locationId: string;
  locationName: string;
  timestamp: string;
  presentCharacters: {
    characterId: string;
    characterName: string;
    locationId: string;
  }[];
}

// OffGame Chat types
export interface OffGameMessageNotification {
  chatId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'user' | 'system';
  timestamp: Date;
  isRead: boolean;
}

export interface OffGameChatEvent {
  type: 'message' | 'name_change' | 'participant_added' | 'participant_removed';
  chatId: string;
  timestamp: string;
  data?: any;
}

// OnGame Message types (Victorian postal system)
export interface OnGameMessageNotification {
  messageId: string;
  fromCharacterId: string;
  fromCharacterName: string;
  toCharacterIds: string[];
  messageType: string;
  subject: string;
  content: string;
  sentAt: Date;
  deliveredAt: Date;
  icon: string;
  postageCharged: number;
}

// Character status change notification
export interface CharacterStatusChangeNotification {
  type: 'character_status_changed';
  characterId: string;
  characterName: string;
  action: 'approve' | 'reject';
  newStatus: 'APPROVED' | 'DRAFT';
  timestamp: string;
  message: string;
}

// WebSocket Context interface
interface WebSocketContextType {
  // Connection state
  isConnected: boolean;
  connectionError: string | null;
  socket: Socket | null;
  
  // Current user/character info
  currentCharacterId: string | null;
  currentLocationId: string | null;
  
  // Event handlers
  onLocationAction: (callback: (notification: LocationMessageNotification) => void) => () => void;
  onPresenceUpdate: (callback: (update: GlobalPresenceUpdate) => void) => () => void;
  onLocationEvent: (callback: (event: LocationEvent) => void) => () => void;
  onLocationJoined: (callback: (event: LocationJoinedEvent) => void) => () => void;
  onTypingUpdate: (callback: (data: { characterName: string; typing: boolean; locationId: string }) => void) => () => void;
  onOffGameMessage: (callback: (notification: OffGameMessageNotification) => void) => () => void;
  onOffGameChatEvent: (callback: (event: OffGameChatEvent) => void) => () => void;
  onOnGameMessage: (callback: (notification: OnGameMessageNotification) => void) => () => void;
  onCharacterStatusChange: (callback: (notification: CharacterStatusChangeNotification) => void) => () => void;
  
  // Actions
  sendLocationAction: (action: Omit<LocationAction, 'characterId' | 'characterName' | 'timestamp' | 'characterRoles'>) => void;
  joinLocation: (locationId: string) => void;
  leaveLocation: (locationId: string) => void;
  startTyping: (locationId: string) => void;
  stopTyping: (locationId: string) => void;
  joinOffGameChats: () => void;
  
  // Connection management
  connect: () => void;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

// Custom hook to use WebSocket context
export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

// WebSocket Provider component
interface WebSocketProviderProps {
  children: ReactNode;
  characterId?: string;
  characterName?: string;
  characterRoles?: string[];
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  characterId,
  characterName,
  characterRoles = []
}) => {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null);

  // Event callback storage using refs to avoid dependency issues
  const locationActionCallbacks = useRef<((notification: LocationMessageNotification) => void)[]>([]);
  const presenceUpdateCallbacks = useRef<((update: GlobalPresenceUpdate) => void)[]>([]);
  const locationEventCallbacks = useRef<((event: LocationEvent) => void)[]>([]);
  const locationJoinedCallbacks = useRef<((event: LocationJoinedEvent) => void)[]>([]);
  const typingUpdateCallbacks = useRef<((data: { characterName: string; typing: boolean; locationId: string }) => void)[]>([]);
  const offGameMessageCallbacks = useRef<((notification: OffGameMessageNotification) => void)[]>([]);
  const offGameChatEventCallbacks = useRef<((event: OffGameChatEvent) => void)[]>([]);
  const onGameMessageCallbacks = useRef<((notification: OnGameMessageNotification) => void)[]>([]);
  const characterStatusChangeCallbacks = useRef<((notification: CharacterStatusChangeNotification) => void)[]>([]);

  // WebSocket should use cookies automatically, no need to extract them manually

  // Debug event emitter
  const emitDebugEvent = useCallback((type: 'OUTGOING' | 'INCOMING' | 'CONNECTION' | 'ERROR', eventName: string, data?: any) => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      window.dispatchEvent(new CustomEvent('websocket-debug', {
        detail: { type, eventName, data }
      }));
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    // console.log('🔌 WebSocket: Connect function called with characterId:', characterId);
    
    if (socket?.connected) {
      // console.log('🔌 WebSocket: Already connected');
      return;
    }

    if (!characterId) {
      console.error('🔌 WebSocket: Missing characterId');
      setConnectionError('Missing character data');
      return;
    }

    // console.log('🔌 WebSocket: Connecting to game backend...');

    const socketInstance = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001', {
      withCredentials: true, // This will send cookies automatically
      transports: ['websocket', 'polling'],
      timeout: 10000
    });

    // Connection events
    socketInstance.on('connect', () => {
      // console.log('🔌 WebSocket: Successfully connected');
      setIsConnected(true);
      setConnectionError(null);
    });

    socketInstance.on('disconnect', (reason) => {
      // console.log('🔌 WebSocket: Disconnected, reason:', reason);
      setIsConnected(false);
      setCurrentLocationId(null);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('🔌 WebSocket: Connection error:', error);
      setIsConnected(false);
      setConnectionError(error.message);
    });

    // Game events - notifications only
    socketInstance.on('location_message_notification', (notification: LocationMessageNotification) => {
      // console.log('🔔 WebSocket: Received location_message_notification:', notification);
      emitDebugEvent('INCOMING', 'location_message_notification', notification);
      locationActionCallbacks.current.forEach(callback => callback(notification));
    });

    socketInstance.on('user_status_change', (update: GlobalPresenceUpdate) => {
      emitDebugEvent('INCOMING', 'user_status_change', update);
      presenceUpdateCallbacks.current.forEach(callback => callback(update));
    });

    socketInstance.on('global_presence_update', (update: any) => {
      // console.log('🌍 WebSocket: Received global_presence_update:', update);
      emitDebugEvent('INCOMING', 'global_presence_update', update);
      presenceUpdateCallbacks.current.forEach(callback => callback(update));
    });

    socketInstance.on('player_entered', (event: LocationEvent) => {
      // console.log('📥 WebSocket: Received player_entered event:', event);
      emitDebugEvent('INCOMING', 'player_entered', event);
      locationEventCallbacks.current.forEach(callback => callback({ ...event, type: 'player_entered' }));
    });

    socketInstance.on('player_left', (event: LocationEvent) => {
      // console.log('📥 WebSocket: Received player_left event:', event);
      emitDebugEvent('INCOMING', 'player_left', event);
      locationEventCallbacks.current.forEach(callback => callback({ ...event, type: 'player_left' }));
    });

    socketInstance.on('user_typing', (data) => {
      emitDebugEvent('INCOMING', 'user_typing', data);
      typingUpdateCallbacks.current.forEach(callback => callback(data));
    });

    socketInstance.on('location_joined', (data: LocationJoinedEvent) => {
      // console.log('📥 WebSocket: Received location_joined event:', data);
      // console.log('🔄 WebSocket: Current router pathname:', router.pathname);
      // console.log('🔄 WebSocket: Target route:', `/locations/${data.locationId}`);
      emitDebugEvent('INCOMING', 'location_joined', data);
      
      // Auto-redirect: if we receive location_joined, it means WE joined (server only sends this to the character who joined)
      // console.log('🔄 WebSocket: location_joined received, auto-redirecting to:', data.locationId);
      
      const targetPath = `/locations/${data.locationId}`;
      // console.log('🚀 WebSocket: Executing router.push to:', targetPath);
      
      // Clear any enter chat loading states
      window.dispatchEvent(new CustomEvent('location-entered'));
      
      router.push(targetPath).then(() => {
        // console.log('✅ WebSocket: Navigation completed to:', targetPath);
      }).catch((error) => {
        console.error('❌ WebSocket: Navigation failed:', error);
      });
      
      locationJoinedCallbacks.current.forEach(callback => callback(data));
    });

    // OffGame chat events
    socketInstance.on('offgame_message_received', (notification: OffGameMessageNotification) => {
      // console.log('🔔 WebSocket: Received offgame_message_received:', notification);
      emitDebugEvent('INCOMING', 'offgame_message_received', notification);
      offGameMessageCallbacks.current.forEach(callback => callback(notification));
    });

    socketInstance.on('offgame_chat_updated', (event: OffGameChatEvent) => {
      // console.log('🔔 WebSocket: Received offgame_chat_updated:', event);
      emitDebugEvent('INCOMING', 'offgame_chat_updated', event);
      offGameChatEventCallbacks.current.forEach(callback => callback(event));
    });

    // OnGame messages (Victorian postal system)
    socketInstance.on('ongame:message_delivered', (notification: OnGameMessageNotification) => {
      // console.log('📮 WebSocket: Received ongame:message_delivered:', notification);
      emitDebugEvent('INCOMING', 'ongame:message_delivered', notification);
      onGameMessageCallbacks.current.forEach(callback => callback(notification));
    });

    socketInstance.on('ongame:message_sent', (notification: OnGameMessageNotification) => {
      // console.log('📮 WebSocket: Received ongame:message_sent:', notification);
      emitDebugEvent('INCOMING', 'ongame:message_sent', notification);
      onGameMessageCallbacks.current.forEach(callback => callback(notification));
    });

    socketInstance.on('ongame:message_delivery_confirmed', (notification: OnGameMessageNotification) => {
      // console.log('📮 WebSocket: Received ongame:message_delivery_confirmed:', notification);
      emitDebugEvent('INCOMING', 'ongame:message_delivery_confirmed', notification);
      onGameMessageCallbacks.current.forEach(callback => callback(notification));
    });

    socketInstance.on('offgame_chats_joined', (data: { chatCount: number; timestamp: string }) => {
      // console.log('🔔 WebSocket: Received offgame_chats_joined confirmation:', data);
      emitDebugEvent('INCOMING', 'offgame_chats_joined', data);
    });

    // Character status change events (approval/rejection)
    socketInstance.on('character_status_changed', (notification: CharacterStatusChangeNotification) => {
      console.log('✅ WebSocket: Received character_status_changed:', notification);
      emitDebugEvent('INCOMING', 'character_status_changed', notification);
      characterStatusChangeCallbacks.current.forEach(callback => callback(notification));
    });

    setSocket(socketInstance);
  }, [characterId, emitDebugEvent, router]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (socket) {
      // console.log('🔌 WebSocket: Disconnecting...');
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setCurrentLocationId(null);
    }
  }, [socket]);

  // Auto-connect when character data is available
  useEffect(() => {
    if (characterId && characterName && !socket?.connected) {
      // console.log('🔌 WebSocket: useEffect triggered with characterId:', characterId, 'characterName:', characterName);
      const timer = setTimeout(() => {
        if (!socket?.connected) {
          connect();
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [characterId, characterName, socket?.connected, connect]);

  // Event subscription methods
  const onLocationAction = useCallback((callback: (notification: LocationMessageNotification) => void) => {
    locationActionCallbacks.current.push(callback);
    return () => {
      locationActionCallbacks.current = locationActionCallbacks.current.filter(cb => cb !== callback);
    };
  }, []); 

  const onPresenceUpdate = useCallback((callback: (update: GlobalPresenceUpdate) => void) => {
    presenceUpdateCallbacks.current.push(callback);
    return () => {
      presenceUpdateCallbacks.current = presenceUpdateCallbacks.current.filter(cb => cb !== callback);
    };
  }, []);

  const onLocationEvent = useCallback((callback: (event: LocationEvent) => void) => {
    locationEventCallbacks.current.push(callback);
    return () => {
      locationEventCallbacks.current = locationEventCallbacks.current.filter(cb => cb !== callback);
    };
  }, []);

  const onLocationJoined = useCallback((callback: (event: LocationJoinedEvent) => void) => {
    locationJoinedCallbacks.current.push(callback);
    return () => {
      locationJoinedCallbacks.current = locationJoinedCallbacks.current.filter(cb => cb !== callback);
    };
  }, []);

  const onTypingUpdate = useCallback((callback: (data: { characterName: string; typing: boolean; locationId: string }) => void) => {
    typingUpdateCallbacks.current.push(callback);
    return () => {
      typingUpdateCallbacks.current = typingUpdateCallbacks.current.filter(cb => cb !== callback);
    };
  }, []);

  const onOffGameMessage = useCallback((callback: (notification: OffGameMessageNotification) => void) => {
    offGameMessageCallbacks.current.push(callback);
    return () => {
      offGameMessageCallbacks.current = offGameMessageCallbacks.current.filter(cb => cb !== callback);
    };
  }, []);

  const onOffGameChatEvent = useCallback((callback: (event: OffGameChatEvent) => void) => {
    offGameChatEventCallbacks.current.push(callback);
    return () => {
      offGameChatEventCallbacks.current = offGameChatEventCallbacks.current.filter(cb => cb !== callback);
    };
  }, []);

  const onOnGameMessage = useCallback((callback: (notification: OnGameMessageNotification) => void) => {
    onGameMessageCallbacks.current.push(callback);
    return () => {
      onGameMessageCallbacks.current = onGameMessageCallbacks.current.filter(cb => cb !== callback);
    };
  }, []);

  const onCharacterStatusChange = useCallback((callback: (notification: CharacterStatusChangeNotification) => void) => {
    characterStatusChangeCallbacks.current.push(callback);
    return () => {
      characterStatusChangeCallbacks.current = characterStatusChangeCallbacks.current.filter(cb => cb !== callback);
    };
  }, []);

  // Action methods (deprecated - use HTTP instead)
  const sendLocationAction = useCallback((actionData: Omit<LocationAction, 'characterId' | 'characterName' | 'timestamp' | 'characterRoles'>) => {
    console.warn('🔌 WebSocket: sendLocationAction is deprecated. Use HTTP endpoints instead.');
    // Keep for backward compatibility but log warning
  }, []);

  const joinLocation = useCallback((locationId: string) => {
    if (!socket?.connected) {
      console.error('🔌 WebSocket: Cannot join location - not connected');
      return;
    }

    // console.log('🔌 WebSocket: Joining location', locationId);
    socket.emit('join_location', locationId);
    emitDebugEvent('OUTGOING', 'join_location', { locationId });
    setCurrentLocationId(locationId);
    
    // Remove the old confirmation listener since we now handle it in the main socket setup
  }, [socket, emitDebugEvent]);

  const leaveLocation = useCallback((locationId: string) => {
    if (!socket?.connected) return;

    socket.emit('leave_location', locationId);
    emitDebugEvent('OUTGOING', 'leave_location', { locationId });
    if (currentLocationId === locationId) {
      setCurrentLocationId(null);
    }
  }, [socket, currentLocationId, emitDebugEvent]);

  const startTyping = useCallback((locationId: string) => {
    if (!socket?.connected) return;
    socket.emit('typing_start', locationId);
    emitDebugEvent('OUTGOING', 'typing_start', { locationId });
  }, [socket, emitDebugEvent]);

  const stopTyping = useCallback((locationId: string) => {
    if (!socket?.connected) return;
    socket.emit('typing_stop', locationId);
    emitDebugEvent('OUTGOING', 'typing_stop', { locationId });
  }, [socket, emitDebugEvent]);

  const joinOffGameChats = useCallback(() => {
    if (!socket?.connected) {
      console.error('🔌 WebSocket: Cannot join OffGame chats - not connected');
      return;
    }

    // console.log('🔌 WebSocket: Joining OffGame chats');
    socket.emit('join_offgame_chats');
    emitDebugEvent('OUTGOING', 'join_offgame_chats', {});
  }, [socket, emitDebugEvent]);

  const contextValue: WebSocketContextType = {
    isConnected,
    connectionError,
    socket,
    currentCharacterId: characterId || null,
    currentLocationId,
    onLocationAction,
    onPresenceUpdate,
    onLocationEvent,
    onLocationJoined,
    onTypingUpdate,
    onOffGameMessage,
    onOffGameChatEvent,
    onOnGameMessage,
    onCharacterStatusChange,
    sendLocationAction, // deprecated
    joinLocation,
    leaveLocation,
    startTyping,
    stopTyping,
    joinOffGameChats,
    connect,
    disconnect
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};