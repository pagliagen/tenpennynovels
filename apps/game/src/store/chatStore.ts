/**
 * Chat Store (Zustand, in-memory only)
 *
 * Manages location chat state:
 * - Message history (last 3 hours, backend enforced)
 * - Occupants list (real-time presence)
 * - Typing indicators
 * - Current position (sub-chat placement)
 *
 * **No Persistence**: Chat messages are ephemeral (3-hour window).
 * State resets on page refresh - intentional for privacy/performance.
 *
 * **Real-Time Updates**: Messages arrive via WebSocket broadcast,
 * not polling. See useLocationChat hook for WebSocket subscriptions.
 *
 * @module store/chatStore
 * @since 2.0.0
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { locationChatsApi } from '@/lib/api/locationChats';
import { locationsApi } from '@/lib/api/locations';
import type { ChatMessage, ChatOccupant } from '@/types/chat';
import { logger } from '@/lib/logger';

/**
 * LocalStorage Key for Location Positions
 */
const LOCATION_POSITIONS_KEY = 'tenpennynovels-location-positions';

/**
 * Load Saved Position for Location
 *
 * Retrieves the last selected position for a specific location from localStorage.
 *
 * @param locationId - Location ID
 * @returns Saved position or null if not found
 */
function loadPositionForLocation(locationId: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const saved = localStorage.getItem(LOCATION_POSITIONS_KEY);
    if (!saved) return null;

    const positions = JSON.parse(saved) as Record<string, string>;
    return positions[locationId] || null;
  } catch (error) {
    logger.error('Failed to load location position from localStorage:', { error });
    return null;
  }
}

/**
 * Save Position for Location
 *
 * Persists the selected position for a specific location to localStorage.
 *
 * @param locationId - Location ID
 * @param position - Position to save
 */
function savePositionForLocation(locationId: string, position: string): void {
  if (typeof window === 'undefined') return;

  try {
    const saved = localStorage.getItem(LOCATION_POSITIONS_KEY);
    const positions = saved ? (JSON.parse(saved) as Record<string, string>) : {};

    positions[locationId] = position;

    localStorage.setItem(LOCATION_POSITIONS_KEY, JSON.stringify(positions));
  } catch (error) {
    logger.error('Failed to save location position to localStorage:', { error });
  }
}

/**
 * Chat Store State Interface
 */
interface ChatStore {
  // Current location context
  locationSlug: string | null;
  locationId: string | null;
  locationName: string | null;

  // Messages (loaded from API, updated via WebSocket)
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;

  // Real-time presence
  occupants: ChatOccupant[];

  // User's current position (sub-chat placement)
  currentPosition: string | null;

  // Typing indicators (characterId → isTyping)
  typingUsers: Map<string, boolean>;

  // Actions - Initialization
  initialize: (locationSlug: string, locationId: string, locationName: string) => Promise<void>;
  reset: () => void;

  // Actions - Messages
  loadMessages: (locationId: string) => Promise<void>;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  deleteMessage: (messageId: string) => void;

  // Actions - Occupants
  setOccupants: (occupants: ChatOccupant[]) => void;
  addOccupant: (occupant: ChatOccupant) => void;
  removeOccupant: (characterId: string) => void;
  updateOccupant: (characterId: string, updates: Partial<ChatOccupant>) => void;

  // Actions - Position
  setCurrentPosition: (position: string) => void;

  // Actions - Typing Indicators
  setTyping: (characterId: string, isTyping: boolean) => void;
  clearTyping: (characterId: string) => void;
}

/**
 * Initial State Factory
 */
const initialState = () => ({
  // Location context
  locationSlug: null,
  locationId: null,
  locationName: null,

  // Messages
  messages: [],
  isLoading: false,
  error: null,

  // Presence
  occupants: [],

  // Position
  currentPosition: null,

  // Typing
  typingUsers: new Map<string, boolean>(),
});

/**
 * Chat Store (Zustand)
 *
 * Centralized state management for location chat.
 * Use via `useChatStore()` hook in components.
 *
 * @example
 * ```typescript
 * // In component
 * import { useChatStore } from '@/store/chatStore';
 *
 * function ChatContainer() {
 *   const { messages, isLoading, initialize } = useChatStore();
 *
 *   useEffect(() => {
 *     initialize('westminster', 'abc123', 'Westminster');
 *   }, []);
 *
 *   return <MessageList messages={messages} />;
 * }
 * ```
 */
export const useChatStore = create<ChatStore>()(
  devtools(
    (set, get) => ({
      ...initialState(),

      /**
       * Initialize Chat for Location
       *
       * Sets location context and loads initial messages.
       * Also restores the last selected position for this location (if any).
       * Call this when user navigates to chat page.
       *
       * @param locationSlug - Location slug (from URL)
       * @param locationId - Location ID (for API calls)
       * @param locationName - Location name (for header display)
       */
      initialize: async (locationSlug, locationId, locationName) => {
        // Reset state first
        set(initialState());

        // Set location context
        set({
          locationSlug,
          locationId,
          locationName,
        });

        // Load saved position for this location (if exists)
        const savedPosition = loadPositionForLocation(locationId);
        if (savedPosition) {
          set({ currentPosition: savedPosition });
          logger.info(`🔖 Restored saved position for location: ${savedPosition}`);
        }

        // Load messages + current occupants in parallel. Occupants seed the
        // store with everyone already present - without this, occupants only
        // grows via the player_entered WebSocket event (join AFTER this client
        // connected), so anyone already in the location when the page loads
        // is invisible client-side (e.g. confrontation button stays disabled).
        await Promise.all([
          get().loadMessages(locationId),
          locationsApi.getOccupants(locationId)
            .then(({ occupants }) => {
              get().setOccupants(
                occupants.map((occ) => ({
                  characterId: occ.characterId,
                  characterName: occ.characterName,
                  currentTag: occ.currentTag || undefined,
                  isActive: true,
                }))
              );
            })
            .catch((error) => {
              logger.error('❌ Failed to load location occupants:', { error });
            }),
        ]);
      },

      /**
       * Reset Store
       *
       * Clears all state. Call when leaving chat page.
       */
      reset: () => {
        set(initialState());
      },

      /**
       * Load Messages from API
       *
       * Fetches message history (last 3 hours, up to 100 messages).
       * Backend enforces time window.
       *
       * @param locationId - Location ID
       */
      loadMessages: async (locationId: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await locationChatsApi.getHistory(locationId);

          // API returns MessageHistoryResponse { messages: [...], totalCount, hasMore }
          const messages = response.messages && Array.isArray(response.messages)
            ? response.messages
            : [];

          if (messages.length === 0 && response.messages) {
            logger.warn('⚠️  Unexpected API response structure:', { response });
          }

          set({
            messages,
            isLoading: false,
          });

          logger.info(`✅ Loaded ${messages.length} messages for location ${locationId}`, { value: {
            totalCount: response.totalCount,
            hasMore: response.hasMore
          } });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load messages';

          set({
            error: errorMessage,
            isLoading: false,
          });

          logger.error('❌ Failed to load chat messages:', { error });
        }
      },

      /**
       * Add Message (Real-Time)
       *
       * Adds a new message to the list.
       * Called when WebSocket `location_message_notification` event is received.
       *
       * **Deduplication**: Checks if message already exists (by ID) before adding.
       *
       * @param message - New message to add
       */
      addMessage: (message: ChatMessage) => {
        set((state) => {
          // Check if message already exists (prevent duplicates)
          const exists = state.messages.some((m) => m._id === message._id);
          if (exists) {
            logger.warn(`⚠️  Duplicate message ignored: ${message._id}`);
            return state;
          }

          return {
            messages: [...state.messages, message],
          };
        });
      },

      /**
       * Update Message
       *
       * Updates an existing message (e.g., after edit).
       * Used when edit API call succeeds or when refresh is triggered.
       *
       * @param messageId - Message ID to update
       * @param updates - Partial message updates
       */
      updateMessage: (messageId: string, updates: Partial<ChatMessage>) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg._id === messageId ? { ...msg, ...updates } : msg
          ),
        }));
      },

      /**
       * Delete Message
       *
       * Removes a message from the list.
       * Used when delete API call succeeds or when refresh is triggered.
       *
       * @param messageId - Message ID to delete
       */
      deleteMessage: (messageId: string) => {
        set((state) => ({
          messages: state.messages.filter((msg) => msg._id !== messageId),
        }));
      },

      /**
       * Set Occupants List
       *
       * Replaces entire occupants list.
       * Called when loading location data or receiving full presence update.
       *
       * @param occupants - Full occupants list
       */
      setOccupants: (occupants: ChatOccupant[]) => {
        set({ occupants });
      },

      /**
       * Add Occupant (Real-Time)
       *
       * Adds a character to occupants list.
       * Called when WebSocket `player_entered` event is received.
       *
       * @param occupant - Character to add
       */
      addOccupant: (occupant: ChatOccupant) => {
        set((state) => {
          // Check if already in list (prevent duplicates)
          const exists = state.occupants.some((o) => o.characterId === occupant.characterId);
          if (exists) {
            logger.warn(`⚠️  Occupant already in list: ${occupant.characterName}`);
            return state;
          }

          return {
            occupants: [...state.occupants, occupant],
          };
        });
      },

      /**
       * Remove Occupant (Real-Time)
       *
       * Removes a character from occupants list.
       * Called when WebSocket `player_left` event is received.
       *
       * @param characterId - Character ID to remove
       */
      removeOccupant: (characterId: string) => {
        set((state) => ({
          occupants: state.occupants.filter((o) => o.characterId !== characterId),
        }));
      },

      /**
       * Update Occupant
       *
       * Updates occupant data (e.g., tag change, active status).
       * Called when WebSocket presence update is received.
       *
       * @param characterId - Character ID to update
       * @param updates - Partial occupant updates
       */
      updateOccupant: (characterId: string, updates: Partial<ChatOccupant>) => {
        set((state) => ({
          occupants: state.occupants.map((o) =>
            o.characterId === characterId ? { ...o, ...updates } : o
          ),
        }));
      },

      /**
       * Set Current Position
       *
       * Sets user's sub-chat position.
       * Automatically saves to localStorage for this location.
       * Called when user selects a position in PositionSelector modal.
       *
       * @param position - Position value (e.g., "Tavolo 1", "Bancone")
       */
      setCurrentPosition: (position: string) => {
        const { locationId } = get();

        set({ currentPosition: position });
        logger.info(`✅ Position set to: ${position}`);

        // Save to localStorage for this location
        if (locationId) {
          savePositionForLocation(locationId, position);
        }
      },

      /**
       * Set Typing Indicator
       *
       * Updates typing status for a character.
       * Called when WebSocket `user_typing` event is received.
       *
       * @param characterId - Character ID
       * @param isTyping - Whether character is typing
       */
      setTyping: (characterId: string, isTyping: boolean) => {
        set((state) => {
          const newTypingUsers = new Map(state.typingUsers);
          newTypingUsers.set(characterId, isTyping);

          return { typingUsers: newTypingUsers };
        });
      },

      /**
       * Clear Typing Indicator
       *
       * Removes typing indicator for a character.
       * Called when typing timeout expires (3s inactivity).
       *
       * @param characterId - Character ID
       */
      clearTyping: (characterId: string) => {
        set((state) => {
          const newTypingUsers = new Map(state.typingUsers);
          newTypingUsers.delete(characterId);

          return { typingUsers: newTypingUsers };
        });
      },
    }),
    {
      name: 'ChatStore', // DevTools name
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

/**
 * Selector Hooks (Optimized)
 *
 * Use these instead of full store to prevent unnecessary re-renders.
 *
 * @example
 * ```typescript
 * // Instead of:
 * const { messages } = useChatStore();
 *
 * // Use:
 * const messages = useChatMessages();
 * ```
 */

export const useChatMessages = () => useChatStore((state) => state.messages);
export const useChatOccupants = () => useChatStore((state) => state.occupants);
export const useChatLoading = () => useChatStore((state) => state.isLoading);
export const useChatError = () => useChatStore((state) => state.error);
export const useChatCurrentPosition = () => useChatStore((state) => state.currentPosition);
export const useChatTypingUsers = () => useChatStore((state) => state.typingUsers);
export const useChatLocationContext = () =>
  useChatStore((state) => ({
    slug: state.locationSlug,
    id: state.locationId,
    name: state.locationName,
  }));
