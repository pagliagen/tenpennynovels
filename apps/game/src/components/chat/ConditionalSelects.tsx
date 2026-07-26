/**
 * Conditional Selects Component
 *
 * Renders action-specific selects (whisper target, skill, stat, item)
 * based on selected action type.
 *
 * @module components/chat/ConditionalSelects
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/chat/ConditionalSelects.module.scss';
import type { ActionType } from '@/types/chat';

/**
 * Occupant data for whisper targets
 */
interface Occupant {
  characterId: string;
  characterName: string;
}

/**
 * Skill data
 */
interface Skill {
  name: string;
  value: number;
  category?: string;
}

/**
 * Item data
 */
interface Item {
  id: string;
  name: string;
  category?: string;
}

/**
 * Conditional Selects Props
 */
interface ConditionalSelectsProps {
  /** Selected action type */
  selectedAction: ActionType;

  /** Current character ID (to exclude from whisper targets) */
  currentCharacterId: string;

  /** Location occupants (for whisper targets) */
  occupants: Occupant[];

  /** Character skills (for skill checks) */
  skills?: Skill[];

  /** Character stats (for stat checks) */
  stats?: Record<string, number>;

  /** Character equipped items (for item use) */
  equippedItems?: Item[];

  /** Selected whisper targets */
  targetCharacters: string[];

  /** Selected skill */
  selectedSkill: string;

  /** Selected stat */
  selectedStat: string;

  /** Selected item */
  selectedItem: string;

  /** Callbacks */
  onTargetChange: (targets: string[]) => void;
  onSkillChange: (skill: string) => void;
  onStatChange: (stat: string) => void;
  onItemChange: (item: string) => void;
}

/**
 * Conditional Selects Component
 *
 * Shows appropriate selector based on action type:
 * - whisper → target character picker
 * - skill_check → skill selector
 * - stat_check → stat selector
 * - item_use → item selector
 *
 * @param {ConditionalSelectsProps} props - Component props
 * @returns {JSX.Element | null} Conditional selects or null
 */
export function ConditionalSelects({
  selectedAction,
  currentCharacterId,
  occupants,
  stats = {},
  equippedItems = [],
  targetCharacters,
  selectedStat,
  selectedItem,
  onTargetChange,
  onStatChange,
  onItemChange,
}: ConditionalSelectsProps): JSX.Element | null {
  // Whisper target selection
  if (selectedAction === 'whisper') {
    const otherOccupants = occupants.filter((occ) => occ.characterId !== currentCharacterId);

    // Defensive fallback: whisper shouldn't be selectable without other occupants
    // (see MessageInput.getAvailableActions), but handle it gracefully if it happens
    // (e.g. the last other occupant just left while the selector was open).
    if (otherOccupants.length === 0) {
      return (
        <div className={styles.conditionalSelect}>
          <span className={styles.selectInput}>Nessun altro personaggio presente per un sussurro</span>
        </div>
      );
    }

    // Whisper is strictly one character to another — no "to everyone" option:
    // a message meant for everyone is an OOC or a standard message, not a whisper.
    return (
      <div className={styles.conditionalSelect}>
        <select
          value={targetCharacters[0] || ''}
          onChange={(e) => onTargetChange(e.target.value ? [e.target.value] : [])}
          className={styles.selectInput}
        >
          <option value="">Seleziona Destinatario</option>
          {otherOccupants.map((occupant) => (
            <option key={occupant.characterId} value={occupant.characterId}>
              {occupant.characterName}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Master "esito riservato": optional targeting. No selection → normal
  // public master message (unchanged default). One or more checked → visible
  // only to master + the selected characters (visibility: master_only).
  if (selectedAction === 'master') {
    const otherOccupants = occupants.filter((occ) => occ.characterId !== currentCharacterId);

    if (otherOccupants.length === 0) {
      return null;
    }

    const toggleTarget = (characterId: string) => {
      if (targetCharacters.includes(characterId)) {
        onTargetChange(targetCharacters.filter((id) => id !== characterId));
      } else {
        onTargetChange([...targetCharacters, characterId]);
      }
    };

    return (
      <div className={styles.conditionalSelect}>
        <div className={styles.masterTargetLabel}>
          {targetCharacters.length === 0
            ? 'Visibile a tutti (default) — seleziona per rendere l\'esito riservato:'
            : `Riservato a ${targetCharacters.length} personaggi + master:`}
        </div>
        <div className={styles.masterTargetPicker}>
          {otherOccupants.map((occupant) => (
            <label key={occupant.characterId} className={styles.masterTargetOption}>
              <input
                type="checkbox"
                checked={targetCharacters.includes(occupant.characterId)}
                onChange={() => toggleTarget(occupant.characterId)}
              />
              {occupant.characterName}
            </label>
          ))}
        </div>
      </div>
    );
  }

  // Stat selection
  if (selectedAction === 'stat_check') {
    return (
      <div className={styles.conditionalSelect}>
        <select value={selectedStat} onChange={(e) => onStatChange(e.target.value)} className={styles.selectInput}>
          <option value="">Seleziona Caratteristica</option>
          {(Object.entries(stats) as [string, number][]).map(([statName, statValue]) => (
            <option key={statName} value={statName}>
              {statName} ({statValue})
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Item selection
  if (selectedAction === 'item_use') {
    return (
      <div className={styles.conditionalSelect}>
        <select value={selectedItem} onChange={(e) => onItemChange(e.target.value)} className={styles.selectInput}>
          <option value="">Seleziona Oggetto</option>
          {equippedItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} {item.category && `(${item.category})`}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // No conditional select needed for other actions
  return null;
}
