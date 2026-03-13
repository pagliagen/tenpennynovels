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

import type { ChatMessageType } from '@/types/chat';
import styles from '@/styles/components/chat/ConditionalSelects.module.scss';

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
  selectedAction: ChatMessageType;

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
  skills = [],
  stats = {},
  equippedItems = [],
  targetCharacters,
  selectedSkill,
  selectedStat,
  selectedItem,
  onTargetChange,
  onSkillChange,
  onStatChange,
  onItemChange,
}: ConditionalSelectsProps): JSX.Element | null {
  // Whisper target selection
  if (selectedAction === 'whisper') {
    const otherOccupants = occupants.filter((occ) => occ.characterId !== currentCharacterId);
    const isWhisperGlobal = targetCharacters.length === otherOccupants.length;

    return (
      <div className={styles.conditionalSelect}>
        <select
          value={isWhisperGlobal ? 'all' : targetCharacters[0] || ''}
          onChange={(e) => {
            if (e.target.value === 'all') {
              onTargetChange(otherOccupants.map((occ) => occ.characterId));
            } else if (e.target.value) {
              onTargetChange([e.target.value]);
            } else {
              onTargetChange([]);
            }
          }}
          className={styles.selectInput}
        >
          <option value="">Seleziona Destinatario</option>
          <option value="all">Sussurro a Tutti</option>
          {otherOccupants.map((occupant) => (
            <option key={occupant.characterId} value={occupant.characterId}>
              {occupant.characterName}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Skill selection
  if (selectedAction === 'skill_check') {
    return (
      <div className={styles.conditionalSelect}>
        <select value={selectedSkill} onChange={(e) => onSkillChange(e.target.value)} className={styles.selectInput}>
          <option value="">Seleziona Abilità</option>
          {skills.map((skill) => (
            <option key={skill.name} value={skill.name}>
              {skill.name} ({skill.value}) {skill.category && `[${skill.category}]`}
            </option>
          ))}
        </select>
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
