/**
 * useLocationChat Hook
 *
 * Custom hook for location chat functionality.
 * Handles WebSocket subscriptions, message sending, and state management.
 *
 * **Pattern**: Single-reception-point WebSocket subscriptions (see MEMORY.md).
 * Never call socket.on() directly - always use WebSocketContext callbacks.
 *
 * Features:
 * - Auto-initialize chatStore on mount
 * - Subscribe to real-time events (new messages, typing indicators, presence)
 * - Send messages via API (HTTP reliable writes)
 * - Emit typing indicators via WebSocket
 * - Auto-cleanup on unmount
 *
 * @module hooks/useLocationChat
 * @since 2.0.0
 */

import { useEffect, useCallback, useRef } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { locationChatsApi } from '@/lib/api/locationChats';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useUIStore } from '@/store/uiStore';
import type {
  ChatMessage,
  SendMessageRequest,
  LocationMessageNotification,
  UserTypingEvent,
} from '@/types/chat';

/**
 * useLocationChat Hook Result
 */
interface UseLocationChatResult {
  /** Chat messages */
  messages: ChatMessage[];

  /** Loading state */
  isLoading: boolean;

  /** Error message */
  error: string | null;

  /** Send message */
  sendMessage: (data: SendMessageRequest) => Promise<ChatMessage | null>;

  /** Emit typing indicator */
  startTyping: () => void;

  /** Clear typing indicator */
  stopTyping: () => void;

  /** Manually refresh messages (after edit/delete) */
  refreshMessages: () => Promise<void>;

  /** Current location context */
  location: {
    slug: string | null;
    id: string | null;
    name: string | null;
  };
}

/**
 * useLocationChat Hook
 *
 * Main hook for location chat functionality.
 * Use in ChatContainer component.
 *
 * @param {string} locationSlug - Location slug from URL
 * @param {string} locationId - Location ID (from location data)
 * @param {string} locationName - Location name (for header display)
 * @returns {UseLocationChatResult} Chat state and methods
 *
 * @example
 * ```typescript
 * function ChatContainer() {
 *   const { slug } = useRouter().query;
 *   const location = useLocationStore((s) => s.locations.find(l => l.slug === slug));
 *
 *   const {
 *     messages,
 *     isLoading,
 *     sendMessage,
 *     startTyping,
 *     stopTyping
 *   } = useLocationChat(
 *     location.slug,
 *     location._id,
 *     location.name
 *   );
 *
 *   const handleSend = async () => {
 *     await sendMessage({
 *       messageType: 'standard',
 *       text: 'Good evening!'
 *     });
 *   };
 *
 *   return <MessageList messages={messages} />;
 * }
 * ```
 */
export function useLocationChat(
  locationSlug: string,
  locationId: string,
  locationName: string
): UseLocationChatResult {
  // Zustand stores
  const chatStore = useChatStore();
  const { selectedCharacter } = useAuthStore();

  // WebSocket context (single-reception-point pattern)
  const { socket, onLocationEvent, setCurrentLocationId } = useWebSocket();

  // Typing timeout ref
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Initialize chat store on mount or location change
   */
  useEffect(() => {
    if (!locationSlug || !locationId || !locationName) {
      return;
    }

    // Initialize chat store with location context
    chatStore.initialize(locationSlug, locationId, locationName);

    // Set current location ID for cross-location notification filtering
    setCurrentLocationId(locationId);

    console.log(`✅ Chat initialized for location: ${locationName} (${locationSlug})`);

    // Cleanup on unmount
    return () => {
      chatStore.reset();
      setCurrentLocationId(null);
      console.log(`🧹 Chat store reset`);
    };
  }, [locationSlug, locationId, locationName, setCurrentLocationId]);

  /**
   * Join WebSocket Room for Location
   *
   * Emits join_location to subscribe to real-time events for this location.
   * CRITICAL: Without this, the client won't receive location_message_notification events.
   */
  useEffect(() => {
    console.log('[useLocationChat] Join effect triggered - socket:', !!socket, 'locationId:', locationId);

    if (!socket || !locationId) {
      console.warn('[useLocationChat] Skipping join - socket or locationId missing');
      return;
    }

    // Join the location room (send locationId as string, not object)
    socket.emit('join_location', locationId);
    console.log(`🔗 Joined location room: ${locationId}`);

    // Leave room on unmount
    return () => {
      socket.emit('leave_location', locationId);
      console.log(`🚪 Left location room: ${locationId}`);
    };
  }, [socket, locationId]);

  /**
   * Subscribe to WebSocket: New Messages
   *
   * Listens for `location_message_notification` events.
   * Adds message to store in real-time (< 1s latency).
   *
   * **TiroContrapposto Support**: If message already exists (by ID), updates it instead of adding.
   * This handles in-place message mutations (e.g., reaction_request → combat_action).
   */
  useEffect(() => {
    const unsubscribe = onLocationEvent((event) => {
      // Filter by event type
      if (event.type !== 'location_message_notification') {
        return;
      }

      const payload = event.data as LocationMessageNotification;

      // Filter by location (only process messages for current location)
      if (payload.locationId !== locationId) {
        return;
      }

      // Check if message already exists (for in-place updates)
      const existingMessage = chatStore.messages.find((m) => m._id === payload.message._id);

      if (existingMessage) {
        // Update existing message (TiroContrapposto reaction processed)
        chatStore.updateMessage(payload.message._id, payload.message);
        console.log(`📝 Message updated (real-time): ${payload.message._id}`);
      } else {
        // Add new message
        chatStore.addMessage(payload.message);
        console.log(`📨 New message received (real-time): ${payload.message._id}`);
      }
    });

    return unsubscribe; // Cleanup subscription
  }, [locationId, onLocationEvent]);

  /**
   * Subscribe to WebSocket: Typing Indicators
   *
   * Listens for `user_typing` events.
   * Updates typing indicators in real-time.
   */
  useEffect(() => {
    const unsubscribe = onLocationEvent((event) => {
      if (event.type !== 'user_typing') {
        return;
      }

      const payload = event.data as UserTypingEvent;

      // Filter by location
      if (payload.locationId !== locationId) {
        return;
      }

      // Ignore own typing events
      if (payload.characterId === selectedCharacter?._id) {
        return;
      }

      const isTyping = payload.isTyping ?? payload.typing ?? false;
      if (isTyping) {
        chatStore.setTyping(payload.characterId, true);

        // Auto-clear after 3 seconds of inactivity
        setTimeout(() => {
          chatStore.clearTyping(payload.characterId);
        }, 3000);
      } else {
        chatStore.clearTyping(payload.characterId);
      }
    });

    return unsubscribe;
  }, [locationId, selectedCharacter, onLocationEvent]);

  /**
   * Subscribe to WebSocket: Player Entered/Left
   *
   * Updates occupant list when players join/leave location.
   *
   * **Event Flow**:
   * 1. User enters chat → HTTP enter + WebSocket join_location
   * 2. Backend chatHandlers.ts emits player_entered to room
   * 3. This listener receives event → chatStore.addOccupant()
   * 4. UI updates with new occupant
   */
  useEffect(() => {
    const unsubscribeEntered = onLocationEvent((event) => {
      if (event.type !== 'player_entered') {
        return;
      }

      // Extract occupant data from event.data
      const occupant = {
        characterId: event.data.characterId,
        characterName: event.data.characterName,
        isActive: true, // Player just entered, so they're active
        enteredAt: event.data.timestamp,
      };

      // Add to chatStore occupants list (triggers UI update)
      chatStore.addOccupant(occupant);
      console.log('👋 Player entered location', occupant);
    });

    const unsubscribeLeft = onLocationEvent((event) => {
      if (event.type !== 'player_left') {
        return;
      }

      const characterId = event.data.characterId;
      if (characterId) {
        chatStore.removeOccupant(characterId);
        console.log(`👋 Player left location: ${characterId}`);
      }
    });

    return () => {
      unsubscribeEntered();
      unsubscribeLeft();
    };
  }, [locationId, onLocationEvent]);

  /**
   * Send Message (HTTP POST)
   *
   * Sends message via HTTP API (reliable write).
   * Backend emits WebSocket event after save, triggering real-time update.
   *
   * **Flow**:
   * 1. POST /game/chats → Backend saves to DB
   * 2. Backend emits `location_message_notification` → WebSocket broadcast
   * 3. All clients receive event → chatStore.addMessage() → UI updates
   *
   * @param {SendMessageRequest} data - Message data
   * @returns {Promise<ChatMessage | null>} Created message or null if failed
   */
  const sendMessage = useCallback(
    async (data: SendMessageRequest): Promise<ChatMessage | null> => {
      if (!locationId) {
        console.error('❌ Cannot send message: locationId not set');
        return null;
      }

      if (!selectedCharacter) {
        console.error('❌ Cannot send message: no character selected');
        return null;
      }

      // Get current tag from chatStore (user's position in location)
      const currentTag = useChatStore.getState().currentTag;

      try {
        // Include current position in payload (backend stores in position field)
        const payload: SendMessageRequest = {
          ...data,
          position: currentTag || undefined, // Single string, undefined if not set
        };

        const message = await locationChatsApi.sendMessage(locationId, payload);

        console.log(`✅ Message sent successfully: ${message._id}${currentTag ? ` @ ${currentTag}` : ''}`);

        // Message will appear via WebSocket broadcast (location_message_notification)
        // No need to manually add to store here - trust the WebSocket flow

        return message;
      } catch (error) {
        console.error('❌ Failed to send message:', error);

        const errorMessage = error instanceof Error ? error.message : 'Invio messaggio fallito';
        chatStore.error = errorMessage;
        useUIStore.getState().addToast({
          type: 'error',
          message: errorMessage,
          duration: 4000,
        });

        return null;
      }
    },
    [locationId, selectedCharacter]
  );

  /**
   * Start Typing (Emit WebSocket Event)
   *
   * Emits `user_typing` event via WebSocket.
   * Debounced: Only emits if 300ms have passed since last call.
   *
   * **Note**: Direct socket emit is acceptable here because:
   * - This is an emit (outgoing), not a receive (incoming)
   * - Typing indicators are fire-and-forget (no response expected)
   * - No business logic involved
   */
  const startTyping = useCallback(() => {
    if (!socket || !selectedCharacter || !locationId) {
      return;
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    socket.emit('typing_start', locationId);

    // Auto-stop after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [socket, selectedCharacter, locationId]);

  /**
   * Stop Typing (Emit WebSocket Event)
   *
   * Emits `user_typing` event with isTyping: false.
   */
  const stopTyping = useCallback(() => {
    if (!socket || !selectedCharacter || !locationId) {
      return;
    }

    // Clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    socket.emit('typing_stop', locationId);
  }, [socket, selectedCharacter, locationId]);

  /**
   * Refresh Messages (Manual Reload)
   *
   * Calls API to reload full message history.
   * Used after edit/delete (backend doesn't emit update/delete events yet).
   *
   * @returns {Promise<void>}
   */
  const refreshMessages = useCallback(async (): Promise<void> => {
    if (!locationId) {
      return;
    }

    console.log('🔄 Refreshing messages...');
    await chatStore.loadMessages(locationId);
  }, [locationId]);

  /**
   * Cleanup typing timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    messages: chatStore.messages,
    isLoading: chatStore.isLoading,
    error: chatStore.error,

    // Actions
    sendMessage,
    startTyping,
    stopTyping,
    refreshMessages,

    // Context
    location: {
      slug: chatStore.locationSlug,
      id: chatStore.locationId,
      name: chatStore.locationName,
    },
  };
}
