/**
 * Message Input Component (REFACTORED - Phase 2+3)
 *
 * Complete message input with:
 * - Mandatory position selection
 * - Action type selector (dropdown for standard, whisper, ooc, item_use, master, moderation)
 * - Conditional selects (whisper target, skill, stat, item)
 * - Textarea with character counter
 * - Action buttons (Posizione, Scontro Sociale, Tiro Dado, Usa Skill/Caratteristica)
 *
 * @module components/chat/MessageInput
 * @since 2.0.0
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef, useMemo } from 'react';

import { fakePngApi } from '@/lib/api/fakePng';
import { locationPngApi } from '@/lib/api/locationPng';
import styles from '@/styles/components/chat/MessageInput.module.scss';
import type { ActionType, SendMessageRequest } from '@/types/chat';

import { PngPickerModal } from '../png-picker/PngPickerModal';

import { ActionTypeSelector } from './ActionTypeSelector';
import { ConfrontationModal } from './ConfrontationModal';
import { DiceRollModal } from './DiceRollModal';
import { SkillStatRollModal } from './SkillStatRollModal';
import { PositionSelector } from './PositionSelector';
import { TargetSelectionModal } from './TargetSelectionModal';
import { logger } from '@/lib/logger';

/**
 * Character data needed for action availability
 */
interface CharacterData {
  characterId: string;
  name: string;
  avatar?: string;
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

  /** Current position (mandatory before sending) */
  currentPosition: string | null;

  /** Available positions for this location (from DB) */
  availablePositions?: string[];

  /** Callback to send message */
  onSendMessage: (data: SendMessageRequest) => Promise<void>;

  /** Callback when user starts typing */
  onStartTyping?: () => void;

  /** Callback when user stops typing */
  onStopTyping?: () => void;

  /** Callback when position changes */
  onPositionChange: (position: string) => void;

  /** Disabled state */
  disabled?: boolean;

  /** Placeholder text */
  placeholder?: string;
}

/** Maximum characters allowed */
const MAX_CHARACTERS = 1200;

/**
 * Get available action types for the dropdown, based on character data,
 * game permissions, and whether there is anyone else in the chat to whisper to.
 *
 * "master" is deliberately excluded: authorized characters get a dedicated
 * toggle button instead (see `hasMasterPermission` in the component).
 */
function getAvailableActions(characterData: CharacterData, hasWhisperTargets: boolean): ActionType[] {
  // dice_roll, stat_check moved to dedicated buttons
  const baseActions: ActionType[] = ['standard', 'ooc'];
  const gamePermissions = characterData.gamePermissions || [];

  // Whisper only makes sense if there's at least one other character present
  if (hasWhisperTargets) {
    baseActions.push('whisper');
  }

  // Helper: Check if has permission
  const hasPermission = (permission: string): boolean => {
    return gamePermissions.includes('game:*') || gamePermissions.includes(permission);
  };

  // Item use (only if has equipped items)
  if (characterData.equippedItems && characterData.equippedItems.length > 0) {
    baseActions.push('item_use');
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
function getActionDisplayName(action: ActionType): string {
  const names: Record<ActionType, string> = {
    standard: 'messaggio',
    whisper: 'sussurro',
    ooc: 'messaggio fuori dal gioco',
    dice_roll: 'tiro dado',
    skill_check: 'tiro abilità',
    stat_check: 'tiro caratteristica',
    item_use: 'uso oggetto',
    master: 'annuncio master',
    moderation: 'azione di moderazione',
    // System-generated (not manually created)
    social_confrontation: 'conflitto sociale',
    combat_action: 'azione di combattimento',
    confrontation_reaction_request: 'richiesta reazione',
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
  currentPosition,
  availablePositions,
  onSendMessage,
  onStartTyping,
  onStopTyping,
  onPositionChange,
  disabled = false,
  placeholder,
}: MessageInputProps): JSX.Element {
  // State
  const [messageInput, setMessageInput] = useState('');
  const [selectedAction, setSelectedAction] = useState<ActionType>('standard');
  const [targetCharacters, setTargetCharacters] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPositionSelectorOpen, setIsPositionSelectorOpen] = useState(false);
  const [isPositionButtonFlashing, setIsPositionButtonFlashing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isTargetPopupOpen, setIsTargetPopupOpen] = useState(false);
  const [isSkillStatModalOpen, setIsSkillStatModalOpen] = useState(false);
  const [isDiceRollModalOpen, setIsDiceRollModalOpen] = useState(false);
  const [isConfrontationModalOpen, setIsConfrontationModalOpen] = useState(false);
  const [showPendingReactionModal, setShowPendingReactionModal] = useState(false);
  const [pendingMessageData, setPendingMessageData] = useState<SendMessageRequest | null>(null);
  const [showPngPicker, setShowPngPicker] = useState(false);
  const [selectedLocationPngId, setSelectedLocationPngId] = useState('');

  const gamePermissions = characterData.gamePermissions || [];

  // Master toggle (column 3, authorized characters only) — not in availableActions,
  // see getAvailableActions
  const hasMasterPermission = gamePermissions.includes('game:*') ||
    gamePermissions.includes('game:chat:master-action');

  const hasFakePngPermission = gamePermissions.includes('game:chat:use-fake-png');

  // Fake PNG query (for avatar indicator)
  const { data: fakePngData, refetch: refetchFakePngs } = useQuery({
    queryKey: ['fakePngs', characterData.characterId],
    queryFn: () => fakePngApi.list(characterData.characterId),
    enabled: hasFakePngPermission,
    staleTime: 30000, // 30s
  });

  // Compute current avatar and name (real or fake)
  const currentAvatar = useMemo(() => {
    if (!fakePngData?.activeFakePngId) {
      return characterData.avatar;
    }

    const activeFake = fakePngData.fakePngs.find(
      f => f._id === fakePngData.activeFakePngId
    );

    return activeFake?.avatar || characterData.avatar;
  }, [fakePngData, characterData.avatar]);

  const currentName = useMemo(() => {
    if (!fakePngData?.activeFakePngId) {
      return characterData.name;
    }

    const activeFake = fakePngData.fakePngs.find(
      f => f._id === fakePngData.activeFakePngId
    );

    if (activeFake) {
      return `${activeFake.name}${activeFake.surname ? ' ' + activeFake.surname : ''}`;
    }

    return characterData.name;
  }, [fakePngData, characterData.name]);

  const isMasked = !!fakePngData?.activeFakePngId;

  // Location-scoped PNG personas: fetched for display only (thumbnail/name of
  // the current selection in the trigger button). Visibility of the "PNG"
  // button/tab is decided client-side from hasMasterPermission below — never
  // from whether this fetch succeeds, so a transient/backend failure doesn't
  // make the feature disappear (only its content shows an inline error).
  const { data: locationPngData, refetch: refetchLocationPngs } = useQuery({
    queryKey: ['locationPngs', locationId, characterData.characterId],
    queryFn: () => locationPngApi.list(locationId),
    enabled: hasMasterPermission,
    retry: false,
  });
  const selectedLocationPng = locationPngData?.locationPngs.find(
    (p) => p._id === selectedLocationPngId
  );

  // Refs
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Available actions (whisper requires at least one other character present)
  const hasWhisperTargets = occupants.some((occ) => occ.characterId !== characterData.characterId);
  const availableActions = getAvailableActions(characterData, hasWhisperTargets);

  const hasSocialConflictPermission = gamePermissions.includes('game:*') ||
    gamePermissions.includes('game:chat:social-clash');

  const canOpenConfrontations = occupants.length >= 1;

  /**
   * Fall back to 'standard' if the selected action stops being available
   * (e.g. whisper target left the chat while composing). 'master' is not in
   * availableActions by design (toggle button, not a dropdown entry) so it's
   * allowed here as long as the character still has the permission.
   */
  useEffect(() => {
    const isValidAction = availableActions.includes(selectedAction) ||
      (selectedAction === 'master' && hasMasterPermission);
    if (!isValidAction) {
      setSelectedAction('standard');
      setTargetCharacters([]);
    }
  }, [availableActions, selectedAction, hasMasterPermission]);

  /**
   * Reset action-specific selections when action type changes
   */
  useEffect(() => {
    setSelectedItem('');
    if (selectedAction !== 'whisper' && selectedAction !== 'master') {
      setTargetCharacters([]);
    }
  }, [selectedAction]);

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
   * Handle position selection
   */
  const handlePositionSelect = (position: string) => {
    onPositionChange(position);
    setIsPositionSelectorOpen(false);
    setIsPositionButtonFlashing(false);
  };

  /**
   * Handle skill/stat roll from modal
   * Auto-sends the roll after selection
   * @param type - 'skill' or 'stat'
   * @param id - skillId (ObjectId) for skills, statName for stats
   * @param displayName - name to show in default message
   */
  const handleSkillStatRoll = async (type: 'skill' | 'stat', id: string, displayName: string) => {
    // Validate position first
    if (!currentPosition) {
      setIsPositionButtonFlashing(true);
      setTimeout(() => setIsPositionButtonFlashing(false), 2000);
      return;
    }

    if (isSending) return;

    setIsSending(true);

    try {
      const data: SendMessageRequest = {
        actionType: type === 'skill' ? 'skill_check' : 'stat_check',
        content: messageInput.trim() || `Tiro su ${displayName}`, // Default text if empty
        ...(type === 'skill' ? { skillId: id } : { statName: id }),
        locationPngId: selectedLocationPngId || undefined,
      };

      await onSendMessage(data);

      // Reset form
      setMessageInput('');
      setSelectedAction('standard');
    } catch (error) {
      logger.error('Failed to send skill/stat roll:', { error });
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Handle dice roll from modal
   */
  const handleDiceRoll = async (diceSpec: string) => {
    // MANDATORY POSITION VALIDATION
    if (!currentPosition) {
      setIsPositionButtonFlashing(true);
      setTimeout(() => setIsPositionButtonFlashing(false), 2000);
      return;
    }

    if (isSending) return;
    setIsSending(true);

    try {
      const data: SendMessageRequest = {
        actionType: 'dice_roll',
        content: messageInput.trim() || `Tiro: ${diceSpec}`,
        diceSpec: diceSpec,
        locationPngId: selectedLocationPngId || undefined,
      };

      await onSendMessage(data);

      // Reset form
      setMessageInput('');
      setSelectedAction('standard');
      setIsDiceRollModalOpen(false);
    } catch (error) {
      logger.error('Failed to send dice roll:', { error });
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Send message
   */
  const handleSendMessage = async () => {
    if (isSending || !messageInput.trim()) return;

    // MANDATORY POSITION VALIDATION
    if (!currentPosition) {
      // Flash button to draw attention
      setIsPositionButtonFlashing(true);
      setTimeout(() => setIsPositionButtonFlashing(false), 2000);
      return;
    }

    setIsSending(true);

    let data: SendMessageRequest | undefined;

    try {
      // Build request data
      data = {
        actionType: selectedAction,
        content: messageInput.trim(),
        locationPngId: selectedLocationPngId || undefined,
      };

      // Add action-specific fields
      if (selectedAction === 'whisper' && targetCharacters.length > 0) {
        data.targetCharacters = targetCharacters;
      }

      // Master "esito riservato": no target selected → normal public master message
      // (default). One or more targets selected → visible only to master + those pg.
      if (selectedAction === 'master' && targetCharacters.length > 0) {
        data.targetCharacters = targetCharacters;
        data.visibility = 'master_only';
      }

      if (selectedAction === 'dice_roll') {
        data.diceSpec = '1d100';  // Sistema percentuale
      }

      // skill_check/stat_check handled by dedicated SkillStatRollModal, not via selectedAction

      if (selectedAction === 'item_use' && selectedItem) {
        data.itemId = selectedItem;
      }

      await onSendMessage(data);

      // Reset form
      setMessageInput('');
      setSelectedAction('standard');
      setTargetCharacters([]);
      setSelectedItem('');
    } catch (error: any) {
      logger.error('Failed to send message:', { error });

      // Check if error is PENDING_REACTION_EXISTS
      if (error?.response?.data?.code === 'PENDING_REACTION_EXISTS' && data) {
        setPendingMessageData(data);
        setShowPendingReactionModal(true);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleForceAbortAndSend = async () => {
    if (!pendingMessageData) return;

    setShowPendingReactionModal(false);
    setIsSending(true);

    try {
      // Retry with forceAbortPendingReaction flag
      await onSendMessage({ ...pendingMessageData, forceAbortPendingReaction: true });

      // Reset form
      setMessageInput('');
      setSelectedAction('standard');
      setTargetCharacters([]);
      setSelectedItem('');
      setPendingMessageData(null);
    } catch (error) {
      logger.error('Failed to send message with force abort:', { error });
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Send-time target popup is required for whisper (mandatory recipient),
   * item_use (mandatory item) and master (optional "esito riservato" targets).
   */
  const requiresTargetPopup = selectedAction === 'whisper' ||
    selectedAction === 'item_use' ||
    selectedAction === 'master';

  /**
   * Dispatch Invia click: open the target popup when needed, otherwise send directly.
   */
  const handleSendClick = () => {
    if (isSending || !messageInput.trim()) return;

    if (!currentPosition) {
      setIsPositionButtonFlashing(true);
      setTimeout(() => setIsPositionButtonFlashing(false), 2000);
      return;
    }

    if (requiresTargetPopup) {
      setIsTargetPopupOpen(true);
      return;
    }

    handleSendMessage();
  };

  /**
   * Confirm from the target popup: send, then close the popup regardless of outcome
   * (a failure surfaces via the pending-reaction modal or a logged error).
   */
  const handleConfirmTargetPopup = async () => {
    await handleSendMessage();
    setIsTargetPopupOpen(false);
  };

  /**
   * Toggle "Messaggio Master" (column 3, authorized characters only).
   * Not a dropdown entry — see getAvailableActions.
   */
  const handleToggleMaster = () => {
    setSelectedAction((prev) => (prev === 'master' ? 'standard' : 'master'));
  };

  /**
   * Handle Ctrl+Enter to send
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendClick();
    }
  };

  const hasAuthColumn = hasMasterPermission || hasFakePngPermission;

  return (
    <div className={styles.messageInput}>
      <div className={`${styles.messageInputGrid} ${hasAuthColumn ? styles.hasAuthColumn : ''}`}>
        {/* Column 1 — action type, position, quick actions */}
        <div className={styles.columnActions}>
          <ActionTypeSelector
            selectedAction={selectedAction}
            availableActions={availableActions}
            onActionChange={setSelectedAction}
          />

          <div className={styles.positionWrapper}>
            <button
              type="button"
              onClick={() => setIsPositionSelectorOpen(!isPositionSelectorOpen)}
              className={`${styles.actionButton} ${currentPosition ? styles.active : styles.mandatory} ${isPositionButtonFlashing ? styles.flashing : ''}`}
              title={currentPosition ? `Posizione selezionata: ${currentPosition}` : 'Seleziona una posizione (OBBLIGATORIO)'}
              disabled={disabled}
            >
              Posizione {!currentPosition && '⚠️'}
            </button>
          </div>

          <div className={styles.quickActionsRow}>
            <button
              type="button"
              onClick={() => setIsDiceRollModalOpen(true)}
              className={`${styles.actionButton} ${styles.iconButton}`}
              title="Tiro Dado (Configurabile)"
              aria-label="Tiro Dado"
              disabled={disabled}
            >
              🎲
            </button>
            <button
              type="button"
              onClick={() => setIsSkillStatModalOpen(true)}
              className={`${styles.actionButton} ${styles.iconButton}`}
              title="Usa Abilità o Caratteristica"
              aria-label="Tiro Skill"
              disabled={disabled}
            >
              📊
            </button>
            <button
              type="button"
              onClick={() => setIsConfrontationModalOpen(true)}
              className={`${styles.actionButton} ${styles.iconButton}`}
              title={
                !canOpenConfrontations
                  ? 'Serve almeno un altro personaggio in questa chat per avviare uno scontro'
                  : 'Scontri (Sociali e Combattimento)'
              }
              aria-label="Scontro Sociale"
              disabled={disabled || !hasSocialConflictPermission || !canOpenConfrontations}
            >
              ⚔️
            </button>
          </div>
        </div>

        {/* Column 2 — textarea + counter/expand/invia */}
        <div className={styles.columnMain}>
          <textarea
            value={messageInput}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder || `Scrivi il tuo ${getActionDisplayName(selectedAction)}...`}
            className={`${styles.textarea} ${isExpanded ? styles.expanded : ''}`}
            disabled={disabled}
          />

          <div className={styles.mainFooter}>
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
              onClick={handleSendClick}
              disabled={!messageInput.trim() || isSending || messageInput.length > MAX_CHARACTERS || disabled}
              className={styles.submitButton}
            >
              {isSending ? 'Invio...' : 'Invia'}
            </button>
          </div>
        </div>

        {/* Column 3 — authorized only: master toggle, PNG */}
        {hasAuthColumn && (
          <div className={styles.columnAuth}>
            {hasMasterPermission && (
              <button
                type="button"
                onClick={handleToggleMaster}
                className={`${styles.actionButton} ${selectedAction === 'master' ? styles.active : ''}`}
                title="Componi come annuncio master"
                disabled={disabled}
              >
                📢 Messaggio Master
              </button>
            )}

            {/* PNG: single popup — PNG del personaggio + PNG di location */}
            {(hasFakePngPermission || hasMasterPermission) && (
              <button
                type="button"
                className={`${styles.actionButton} ${styles.pngButton} ${(isMasked || selectedLocationPngId) ? styles.active : ''}`}
                onClick={() => setShowPngPicker(true)}
                disabled={disabled}
                title={
                  isMasked
                    ? `PNG Attivo: ${currentName}`
                    : selectedLocationPng
                    ? `PNG di location: ${selectedLocationPng.name}`
                    : 'Gestisci PNG'
                }
                aria-label="Gestisci PNG"
              >
                <span className={styles.pngButtonThumb}>
                  {isMasked && currentAvatar ? (
                    <img src={currentAvatar} alt="" />
                  ) : !isMasked && selectedLocationPng?.avatar ? (
                    <img src={selectedLocationPng.avatar} alt="" />
                  ) : (
                    <span className={styles.pngButtonPlaceholder}>
                      {(isMasked ? currentName : selectedLocationPng?.name || currentName)[0]?.toUpperCase()}
                    </span>
                  )}
                </span>
                PNG {isMasked && '🎭'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Send-time target popup (whisper recipient / item / master reserved targets) */}
      {isTargetPopupOpen && (
        <TargetSelectionModal
          actionType={selectedAction as 'whisper' | 'item_use' | 'master'}
          occupants={occupants}
          currentCharacterId={characterData.characterId}
          equippedItems={characterData.equippedItems}
          targetCharacters={targetCharacters}
          selectedItem={selectedItem}
          onTargetChange={setTargetCharacters}
          onItemChange={setSelectedItem}
          onConfirm={handleConfirmTargetPopup}
          onClose={() => setIsTargetPopupOpen(false)}
        />
      )}

      {/* Position Selector Modal */}
      {isPositionSelectorOpen && (
        <PositionSelector
          selectedPosition={currentPosition}
          availablePositions={availablePositions}
          onPositionChange={handlePositionSelect}
          onClose={() => setIsPositionSelectorOpen(false)}
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

      {/* Dice Roll Modal */}
      {isDiceRollModalOpen && (
        <DiceRollModal
          onRoll={handleDiceRoll}
          onClose={() => setIsDiceRollModalOpen(false)}
        />
      )}

      {/* Confrontation Modal */}
      {isConfrontationModalOpen && (
        <ConfrontationModal
          locationId={locationId}
          characterSkills={characterData.skills}
          occupants={occupants}
          currentCharacterId={characterData.characterId}
          currentPosition={currentPosition}
          onClose={() => setIsConfrontationModalOpen(false)}
          onSuccess={() => {
            setIsConfrontationModalOpen(false);
            // Message will appear via WebSocket
          }}
        />
      )}

      {/* PNG Picker Modal (PNG del personaggio + PNG di location, unified) */}
      {showPngPicker && (
        <PngPickerModal
          characterId={characterData.characterId}
          locationId={locationId}
          showFakeSection={hasFakePngPermission}
          showLocationSection={hasMasterPermission}
          selectedLocationPngId={selectedLocationPngId}
          onSelectLocationPng={setSelectedLocationPngId}
          onFakePngChanged={refetchFakePngs}
          onLocationPngChanged={refetchLocationPngs}
          onClose={() => setShowPngPicker(false)}
        />
      )}

      {/* Pending Reaction Confirmation Modal */}
      {showPendingReactionModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPendingReactionModal(false)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3>Reazione Pendente</h3>
            <p>
              Hai una reazione pendente da risolvere. Se confermi, verrà dichiarata
              automaticamente fallita e potrai procedere con questa azione.
            </p>
            <div className={styles.modalButtons}>
              <button
                onClick={() => {
                  setShowPendingReactionModal(false);
                  setPendingMessageData(null);
                }}
                className={styles.cancelButton}
              >
                Annulla
              </button>
              <button onClick={handleForceAbortAndSend} className={styles.confirmButton}>
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
