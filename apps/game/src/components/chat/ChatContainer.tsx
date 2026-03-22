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

import { useEffect } from 'react';

import { useCharacterSheetData } from '@/hooks/useCharacterSheetData';
import { useLocationChat } from '@/hooks/useLocationChat';
import { useAuthStore } from '@/store/authStore';
import { useChatOccupants, useChatCurrentTag, useChatStore } from '@/store/chatStore';
import { useLocationStore } from '@/store/locationStore';
import styles from '@/styles/components/chat/ChatContainer.module.scss';

import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import { PermissionBanner } from './PermissionBanner';

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
  const gamePermissions = useAuthStore((state) => state.gamePermissions);

  // Character sheet data (skills, equipment) - React Query hook
  const { data: characterSheet } = useCharacterSheetData(selectedCharacter?._id || '');

  // Location store: Get location positions
  const locations = useLocationStore((state) => state.locations);
  const currentLocation = locations.find((loc) => loc._id === locationId);
  const availablePositions = currentLocation?.positions || [];

  // Chat store: Occupants list and current tag
  const occupants = useChatOccupants();
  const currentTag = useChatCurrentTag();

  // Init tag from localStorage when entering location
  useEffect(() => {
    const stored = localStorage.getItem(`chat-tag-${locationId}`);
    if (stored) {
      useChatStore.getState().setCurrentTag(stored);
    }
  }, [locationId]);

  // Chat hook: Messages, send, typing
  const { messages, isLoading, error, sendMessage, startTyping, stopTyping } = useLocationChat(
    locationSlug,
    locationId,
    locationName
  );

  // Permission check - Use game permissions system
  const hasGamePermission = useAuthStore((state) => state.hasGamePermission);
  const canSendMessages = hasGamePermission('game:chat:send');

  // Master check - Backend provides 'game:chat:master-action' permission for masters/moderators
  // This is driven by character.isGestore + gameplayRoles in backend permission calculation
  const isMaster = hasGamePermission('game:chat:master-action');

  /**
   * Handle tag change
   * Saves tag to localStorage (frontend persistence) and chatStore (UI state).
   */
  const handleTagChange = (tag: string) => {
    // Save to localStorage (persists across page refresh)
    localStorage.setItem(`chat-tag-${locationId}`, tag);

    // Save to chatStore (global UI state)
    useChatStore.getState().setCurrentTag(tag);
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
   * Includes skills and equipment from character sheet (fetched via useEffect).
   */
  const characterData = {
    characterId: selectedCharacter?._id || '',
    name: selectedCharacter?.name || '',
    surname: selectedCharacter?.surname,
    avatar: selectedCharacter?.avatar || undefined,
    skills: characterSheet?.character?.skills
      ? Object.entries(characterSheet.character.skills).map(([skillId, skillData]: [string, any]) => ({
          id: skillId, // Skill ObjectId - needed for secure roll requests
          name: skillData.name || 'Unknown',
          value: skillData.total || skillData.value || 0,
          category: skillData.category,
        }))
      : [],
    stats: (() => {
      const rawStats = characterSheet?.character?.stats || selectedCharacter?.stats || {};
      // Filter out non-numeric fields (like damageBonus which is a string)
      return Object.fromEntries(
        Object.entries(rawStats).filter(([_, value]) => typeof value === 'number')
      ) as Record<string, number>;
    })(),
    equippedItems: characterSheet?.character?.equipment
      ? characterSheet.character.equipment.map(item => ({
          id: item._id,
          name: item.name,
          category: undefined, // Equipment from sheet doesn't have category
        }))
      : [],
    gamePermissions,
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

      {/* Message Input (only if has permission) OR Permission Banner (if no permission) */}
      {canSendMessages ? (
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
        <PermissionBanner />
      )}
    </div>
  );
}
