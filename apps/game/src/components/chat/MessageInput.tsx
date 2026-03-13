/**
 * Message Input Component (REFACTORED - Phase 2+3)
 *
 * Complete message input with:
 * - Mandatory tag selection
 * - Action type selector (dropdown for standard, whisper, ooc, item_use, master, moderation)
 * - Conditional selects (whisper target, skill, stat, item)
 * - Textarea with character counter
 * - Action buttons (Tags, Scontro Sociale, Tiro Dado, Usa Skill/Caratteristica)
 *
 * @module components/chat/MessageInput
 * @since 2.0.0
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { TagSelector } from './TagSelector';
import { ActionTypeSelector } from './ActionTypeSelector';
import { ConditionalSelects } from './ConditionalSelects';
import { SkillStatRollModal } from './SkillStatRollModal';
import { locationChatsApi } from '@/lib/api/locationChats';
import type { ChatMessageType, SendMessageRequest } from '@/types/chat';
import styles from '@/styles/components/chat/MessageInput.module.scss';

/**
 * Character data needed for action availability
 */
interface CharacterData {
  characterId: string;
  skills?: Array<{ id: string; name: string; value: number; category?: string }>;
  stats?: Record<string, number>;
  equippedItems?: Array<{ id: string; name: string; category?: string }>;
  gamePermissions?: string[]; // Game permissions for checking action availability
}

/**
 * Occupant data for whisper targets
 */
interface Occupant {
  characterId: string;
  characterName: string;
}

/**
 * Message Input Props
 */
interface MessageInputProps {
  /** Location ID (for social conflict API calls) */
  locationId: string;

  /** Character data (skills, stats, items, roles) */
  characterData: CharacterData;

  /** Location occupants (for whisper targets) */
  occupants: Occupant[];

  /** Current tag (mandatory before sending) */
  currentTag: string | null;

  /** Available positions for this location (from DB) */
  availablePositions?: string[];

  /** Callback to send message */
  onSendMessage: (data: SendMessageRequest) => Promise<void>;

  /** Callback when user starts typing */
  onStartTyping?: () => void;

  /** Callback when user stops typing */
  onStopTyping?: () => void;

  /** Callback when tag changes */
  onTagChange: (tag: string) => void;

  /** Disabled state */
  disabled?: boolean;

  /** Placeholder text */
  placeholder?: string;
}

/** Maximum characters allowed */
const MAX_CHARACTERS = 2000;

/**
 * Get available action types based on character data and game permissions
 */
function getAvailableActions(characterData: CharacterData): ChatMessageType[] {
  // dice_roll, skill_check, stat_check moved to dedicated buttons
  const baseActions: ChatMessageType[] = ['standard', 'whisper', 'ooc'];
  const gamePermissions = characterData.gamePermissions || [];

  // Helper: Check if has permission
  const hasPermission = (permission: string): boolean => {
    return gamePermissions.includes('game:*') || gamePermissions.includes(permission);
  };

  // Item use (only if has equipped items)
  if (characterData.equippedItems && characterData.equippedItems.length > 0) {
    baseActions.push('item_use');
  }

  // Master actions (only if has master action permission)
  if (hasPermission('game:chat:master-action')) {
    baseActions.push('master');
  }

  // Moderation (only if has moderation action permission)
  if (hasPermission('game:chat:moderation-action')) {
    baseActions.push('moderation');
  }

  return baseActions;
}

/**
 * Get action display name for placeholder
 */
function getActionDisplayName(action: ChatMessageType): string {
  const names: Record<ChatMessageType, string> = {
    standard: 'messaggio',
    whisper: 'sussurro',
    ooc: 'messaggio fuori dal gioco',
    dice_roll: 'tiro dado',
    skill_check: 'tiro abilità',
    stat_check: 'tiro caratteristica',
    item_use: 'uso oggetto',
    master: 'annuncio master',
    moderation: 'azione di moderazione',
  };
  return names[action] || 'messaggio';
}

/**
 * Message Input Component
 *
 * Complete message input with all features.
 *
 * @param {MessageInputProps} props - Component props
 * @returns {JSX.Element} Message input
 */
export function MessageInput({
  locationId,
  characterData,
  occupants,
  currentTag,
  availablePositions,
  onSendMessage,
  onStartTyping,
  onStopTyping,
  onTagChange,
  disabled = false,
  placeholder,
}: MessageInputProps): JSX.Element {
  // State
  const [messageInput, setMessageInput] = useState('');
  const [selectedAction, setSelectedAction] = useState<ChatMessageType>('standard');
  const [targetCharacters, setTargetCharacters] = useState<string[]>([]);
  const [selectedSkill, setSelectedSkill] = useState('');
  const [selectedStat, setSelectedStat] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [isTagButtonFlashing, setIsTagButtonFlashing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSkillStatModalOpen, setIsSkillStatModalOpen] = useState(false);

  // Social conflict mode
  const [isSocialConflictMode, setIsSocialConflictMode] = useState(false);
  const [lieText, setLieText] = useState('');

  // Refs
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Available actions
  const availableActions = getAvailableActions(characterData);

  // Check social conflict permission
  const gamePermissions = characterData.gamePermissions || [];
  const hasSocialConflictPermission = gamePermissions.includes('game:*') ||
    gamePermissions.includes('game:chat:social-clash');

  /**
   * Reset action-specific selections when action type changes
   */
  useEffect(() => {
    setSelectedSkill('');
    setSelectedStat('');
    setSelectedItem('');
    if (selectedAction !== 'whisper' && !isSocialConflictMode) {
      setTargetCharacters([]);
    }
  }, [selectedAction, isSocialConflictMode]);

  /**
   * Toggle social conflict mode
   */
  const toggleSocialConflictMode = () => {
    setIsSocialConflictMode(!isSocialConflictMode);
    if (!isSocialConflictMode) {
      // Entering social conflict mode
      setSelectedAction('standard'); // Reset to standard (we'll handle submit differently)
      setTargetCharacters([]);
      setSelectedSkill('');
      setLieText('');
    } else {
      // Exiting social conflict mode
      setTargetCharacters([]);
      setSelectedSkill('');
      setLieText('');
    }
  };

  /**
   * Handle input change with typing indicators
   */
  const handleInputChange = (value: string) => {
    // Enforce character limit
    if (value.length > MAX_CHARACTERS) {
      return;
    }

    setMessageInput(value);

    // Typing indicator
    if (onStartTyping && value.length > 0) {
      onStartTyping();
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout (stop typing after 1s inactivity)
    typingTimeoutRef.current = setTimeout(() => {
      if (onStopTyping) {
        onStopTyping();
      }
    }, 1000);
  };

  /**
   * Handle tag selection
   */
  const handleTagSelect = (tag: string) => {
    onTagChange(tag);
    setIsTagSelectorOpen(false);
    setIsTagButtonFlashing(false);
  };

  /**
   * Handle skill/stat roll from modal
   * Auto-sends the roll after selection
   * @param type - 'skill' or 'stat'
   * @param id - skillId (ObjectId) for skills, statName for stats
   * @param displayName - name to show in default message
   */
  const handleSkillStatRoll = async (type: 'skill' | 'stat', id: string, displayName: string) => {
    // Validate tag first
    if (!currentTag) {
      setIsTagButtonFlashing(true);
      setTimeout(() => setIsTagButtonFlashing(false), 2000);
      return;
    }

    if (isSending) return;

    setIsSending(true);

    try {
      const data: SendMessageRequest = {
        actionType: type === 'skill' ? 'skill_check' : 'stat_check',
        content: messageInput.trim() || `Tiro su ${displayName}`, // Default text if empty
      };

      if (type === 'skill') {
        data.skillId = id; // Send skill ObjectId, not name - backend will look up value
      } else {
        data.statName = id; // For stats, name is the ID
      }

      await onSendMessage(data);

      // Reset form
      setMessageInput('');
      setSelectedAction('standard');
      setSelectedSkill('');
      setSelectedStat('');
    } catch (error) {
      console.error('Failed to send skill/stat roll:', error);
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Send message (or social conflict)
   */
  const handleSendMessage = async () => {
    if (isSending || !messageInput.trim()) return;

    // MANDATORY TAG VALIDATION
    if (!currentTag) {
      // Flash button to draw attention
      setIsTagButtonFlashing(true);
      setTimeout(() => setIsTagButtonFlashing(false), 2000);
      return;
    }

    setIsSending(true);

    try {
      // SOCIAL CONFLICT MODE
      if (isSocialConflictMode) {
        // Validate social conflict fields
        if (!selectedSkill) {
          console.error('Social conflict requires a skill selection');
          return;
        }
        if (targetCharacters.length === 0) {
          console.error('Social conflict requires a target character');
          return;
        }

        // Call social conflict API
        await locationChatsApi.createSocialConflict({
          locationId,
          attackerSkill: selectedSkill,
          defenderCharacterId: targetCharacters[0]!,
          content: messageInput.trim(),
          lieText: selectedSkill === 'Raggirare' ? lieText : undefined,
        });

        // Reset form
        setMessageInput('');
        setIsSocialConflictMode(false);
        setTargetCharacters([]);
        setSelectedSkill('');
        setLieText('');
        return;
      }

      // STANDARD MESSAGE
      // Build request data
      const data: SendMessageRequest = {
        actionType: selectedAction,
        content: messageInput.trim(),
      };

      // Add action-specific fields
      if (selectedAction === 'whisper' && targetCharacters.length > 0) {
        data.targetCharacters = targetCharacters;
      }

      if (selectedAction === 'dice_roll') {
        data.diceSpec = '1d100';  // Sistema percentuale
      }

      // skill_check/stat_check handled by dedicated SkillStatRollModal, not via selectedAction

      if (selectedAction === 'stat_check' && selectedStat) {
        data.statName = selectedStat;
      }

      if (selectedAction === 'item_use' && selectedItem) {
        data.itemId = selectedItem;
      }

      await onSendMessage(data);

      // Reset form
      setMessageInput('');
      setSelectedAction('standard');
      setTargetCharacters([]);
      setSelectedSkill('');
      setSelectedStat('');
      setSelectedItem('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Handle Ctrl+Enter to send
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={styles.messageInput}>
      <div className={styles.messageInputWrapper}>
        <div className={styles.actionTypeWrapper}>
          {/* Action Type Selector (hidden in social conflict mode) */}
          {!isSocialConflictMode && (
            <div className={styles.actionTypeRow}>
              <ActionTypeSelector
                selectedAction={selectedAction}
                availableActions={availableActions}
                onActionChange={setSelectedAction}
              />
            </div>
          )}

          {/* SOCIAL CONFLICT FIELDS */}
          {isSocialConflictMode && (
            <div className={styles.socialConflictFields}>
              <div className={styles.fieldRow}>
                {/* Target Selector */}
                <select
                  value={targetCharacters[0] || ''}
                  onChange={(e) => setTargetCharacters(e.target.value ? [e.target.value] : [])}
                  className={styles.selectInput}
                  disabled={disabled}
                >
                  <option value="">Seleziona Avversario</option>
                  {occupants
                    .filter((occ) => occ.characterId !== characterData.characterId)
                    .map((occupant) => (
                      <option key={occupant.characterId} value={occupant.characterId}>
                        {occupant.characterName}
                      </option>
                    ))}
                </select>

                {/* Skill Selector (social skills only) */}
                <select
                  value={selectedSkill}
                  onChange={(e) => setSelectedSkill(e.target.value)}
                  className={styles.selectInput}
                  disabled={disabled}
                >
                  <option value="">Seleziona Abilità</option>
                  <option value="Ammaliare">Ammaliare (vs Autocontrollo)</option>
                  <option value="Persuadere">Persuadere (vs Tempra)</option>
                  <option value="Intimidire">Intimidire (vs Autocontrollo)</option>
                  <option value="Oratoria">Oratoria (vs Tempra)</option>
                  <option value="Raggirare">Raggirare (vs Empatia)</option>
                  <option value="Empatia">Empatia (vs Raggirare)</option>
                </select>
              </div>

              {/* Lie Text Field (only for Raggirare) */}
              {selectedSkill === 'Raggirare' && (
                <div className={styles.fieldRow}>
                  <textarea
                    value={lieText}
                    onChange={(e) => setLieText(e.target.value)}
                    placeholder="Intenzione nascosta (visibile solo a te e al master)..."
                    className={styles.lieTextarea}
                    disabled={disabled}
                    rows={2}
                  />
                  <div className={styles.lieWarning}>
                    🔒 Questo testo sarà visibile solo a te e al master. Se fallisci, l'avversario saprà che stai mentendo ma non vedrà questo testo.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Conditional Selects (whisper target, skill, stat, item) - hidden in social conflict mode */}
          {!isSocialConflictMode && (
            <ConditionalSelects
              selectedAction={selectedAction}
              currentCharacterId={characterData.characterId}
              occupants={occupants}
              skills={characterData.skills}
              stats={characterData.stats}
              equippedItems={characterData.equippedItems}
              targetCharacters={targetCharacters}
              selectedSkill={selectedSkill}
              selectedStat={selectedStat}
              selectedItem={selectedItem}
              onTargetChange={setTargetCharacters}
              onSkillChange={setSelectedSkill}
              onStatChange={setSelectedStat}
              onItemChange={setSelectedItem}
            />
          )}
        </div>

        {/* Textarea */}
        <div className={styles.textareaWrapper}>
          <textarea
            value={messageInput}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder || `Scrivi il tuo ${getActionDisplayName(selectedAction)}...`}
            className={`${styles.textarea} ${isExpanded ? styles.expanded : ''}`}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className={styles.inputActions}>
        {/* Left Actions */}
        <div className={styles.leftActions}>
          <button
            type="button"
            onClick={() => setIsTagSelectorOpen(!isTagSelectorOpen)}
            className={`${styles.actionButton} ${currentTag ? styles.active : styles.mandatory} ${isTagButtonFlashing ? styles.flashing : ''}`}
            title={currentTag ? `Tag selezionato: ${currentTag}` : 'Seleziona un tag (OBBLIGATORIO)'}
            disabled={disabled}
          >
            Tags {!currentTag && '⚠️'}
          </button>
          <button
            type="button"
            onClick={toggleSocialConflictMode}
            className={`${styles.actionButton} ${isSocialConflictMode ? styles.active : ''}`}
            title="Scontro Sociale (Raggirare, Persuasione, Intimidazione)"
            disabled={disabled || !hasSocialConflictPermission}
          >
            🎭 Scontro Sociale
          </button>
          <button
            type="button"
            onClick={() => setSelectedAction('dice_roll')}
            className={`${styles.actionButton} ${selectedAction === 'dice_roll' ? styles.active : ''}`}
            title="Tiro Dado (1d100)"
            disabled={disabled || isSocialConflictMode}
          >
            🎲 Tiro Dado
          </button>
          <button
            type="button"
            onClick={() => setIsSkillStatModalOpen(true)}
            className={styles.actionButton}
            title="Usa Abilità o Caratteristica"
            disabled={disabled || isSocialConflictMode}
          >
            📊 Usa Skill/Caratteristica
          </button>
        </div>

        {/* Right Actions */}
        <div className={styles.rightActions}>
          <div className={styles.characterCounter}>
            {messageInput.length}/{MAX_CHARACTERS}
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={styles.expandCollapseButton}
            aria-label={isExpanded ? 'Riduci textarea' : 'Espandi textarea'}
            title={isExpanded ? 'Riduci textarea' : 'Espandi textarea'}
            disabled={disabled}
          >
            {isExpanded ? '↑' : '↓'}
          </button>
          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || isSending || messageInput.length > MAX_CHARACTERS || disabled}
            className={styles.submitButton}
          >
            {isSending ? 'Invio...' : 'Invia'}
          </button>
        </div>
      </div>

      {/* Tag Selector Modal */}
      {isTagSelectorOpen && (
        <TagSelector
          selectedTag={currentTag}
          availablePositions={availablePositions}
          onTagChange={handleTagSelect}
          onClose={() => setIsTagSelectorOpen(false)}
        />
      )}

      {/* Skill/Stat Roll Modal */}
      {isSkillStatModalOpen && (
        <SkillStatRollModal
          skills={characterData.skills}
          stats={characterData.stats}
          onRoll={handleSkillStatRoll}
          onClose={() => setIsSkillStatModalOpen(false)}
        />
      )}
    </div>
  );
}
