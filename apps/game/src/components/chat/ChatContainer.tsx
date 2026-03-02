/**
 * Chat Container Component (REFACTORED - Phase 2+3)
 *
 * Main container for location chat with complete feature set.
 * Integrates all chat sub-components with permission gating.
 *
 * Features:
 * - Permission check (APPROVED characters can write, others read-only)
 * - Tag management (mandatory selection before sending)
 * - Real-time WebSocket subscriptions (via useLocationChat hook)
 * - Smart auto-scroll in message list
 * - Typing indicators
 *
 * @module components/chat/ChatContainer
 * @since 2.0.0
 */

'use client';

import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { PermissionBanner } from './PermissionBanner';
import { useLocationChat } from '@/hooks/useLocationChat';
import { useAuthStore } from '@/store/authStore';
import { useLocationStore } from '@/store/locationStore';
import { useChatOccupants, useChatCurrentTag, useChatStore } from '@/store/chatStore';
import { locationChatsApi } from '@/lib/api/locationChats';
import styles from '@/styles/components/chat/chat.module.scss';

/**
 * Chat Container Props
 */
interface ChatContainerProps {
  /** Location slug (from URL) */
  locationSlug: string;

  /** Location ID */
  locationId: string;

  /** Location name */
  locationName: string;
}

/**
 * Chat Container Component
 *
 * Main chat UI with permission gating.
 *
 * **Permission Logic**:
 * - Character status = APPROVED → Full access (read + write)
 * - Character status = DRAFT/PENDING_APPROVAL/DELETED → Read-only + PermissionBanner
 * - No character selected → Redirect (handled by page)
 *
 * @param {ChatContainerProps} props - Component props
 * @returns {JSX.Element} Chat container
 */
export function ChatContainer({ locationSlug, locationId, locationName }: ChatContainerProps): JSX.Element {
  // Auth store: Character permission check
  const { selectedCharacter } = useAuthStore();

  // Location store: Get location positions
  const locations = useLocationStore((state) => state.locations);
  const currentLocation = locations.find((loc) => loc._id === locationId);
  const availablePositions = currentLocation?.positions || [];

  // Chat store: Occupants list and current tag
  const occupants = useChatOccupants();
  const currentTag = useChatCurrentTag();

  // Chat hook: Messages, send, typing
  const { messages, isLoading, error, sendMessage, startTyping, stopTyping } = useLocationChat(
    locationSlug,
    locationId,
    locationName
  );

  // Permission check
  // Now selectedCharacter.status uses correct backend values ('DRAFT'|'PENDING_APPROVAL'|'APPROVED'|'DELETED')
  const isApproved = selectedCharacter?.status === 'APPROVED';
  const characterStatus: import('@/types/character').CharacterStatus =
    selectedCharacter?.status || 'DRAFT';

  // Master check (TODO: Get from selectedCharacter.gameplayRoles when available)
  // For now, assume non-master. Will be updated when auth system provides roles.
  const isMaster = false; // TODO: selectedCharacter?.gameplayRoles?.includes('master')

  /**
   * Handle tag change
   * Saves tag to chatStore and backend immediately.
   */
  const handleTagChange = async (tag: string) => {
    // Save to chatStore (global state)
    useChatStore.getState().setCurrentTag(tag);

    // Save tag to occupant record
    try {
      await locationChatsApi.updateOccupantTag(locationId, tag);
      console.log(`✅ Tag updated to: ${tag}`);
    } catch (error) {
      console.error('❌ Failed to update occupant tag:', error);
    }
  };

  /**
   * Handle send message
   * Wrapper to discard return value (MessageInput expects Promise<void>)
   */
  const handleSendMessage = async (data: import('@/types/chat').SendMessageRequest): Promise<void> => {
    await sendMessage(data);
    // Discard return value
  };

  /**
   * Build character data for MessageInput
   *
   * Note: selectedCharacter is the base Character type (from auth),
   * not the full CharacterSheet (which has skills, equipment, etc.).
   * MessageInput features requiring full character data may not work.
   */
  const characterData = {
    characterId: selectedCharacter?._id || '',
    // TODO: skills, equippedItems, roles are not available in base Character type
    // These would need to be fetched separately from /game/characters/:id?view=sheet
    skills: [], // Not available in selectedCharacter
    stats: selectedCharacter?.stats || {},
    equippedItems: [], // Not available in selectedCharacter
    roles: [], // Not available in selectedCharacter
  };

  /**
   * Map occupants for MessageInput
   */
  const occupantsList = occupants.map((occ) => ({
    characterId: occ.characterId,
    characterName: occ.characterName,
  }));

  return (
    <div className={styles.chatContainer}>
      {/* Error Banner (API errors) */}
      {error && (
        <div className={styles.permissionBanner} style={{ background: 'rgba(255, 0, 0, 0.2)' }}>
          ⚠️ Errore: {error}
        </div>
      )}

      {/* Message List (scrollable - takes all available space) */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        currentCharacterId={selectedCharacter?._id}
        isMaster={isMaster}
      />

      {/* Message Input (only if APPROVED) OR Permission Banner (if not APPROVED) */}
      {isApproved ? (
        <MessageInput
          locationId={locationId}
          characterData={characterData}
          occupants={occupantsList}
          currentTag={currentTag}
          availablePositions={availablePositions}
          onSendMessage={handleSendMessage}
          onStartTyping={startTyping}
          onStopTyping={stopTyping}
          onTagChange={handleTagChange}
        />
      ) : (
        <PermissionBanner status={characterStatus} />
      )}
    </div>
  );
}
