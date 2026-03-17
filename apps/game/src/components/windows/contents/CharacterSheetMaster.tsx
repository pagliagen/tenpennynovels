/**
 * Character Sheet for PG Master
 *
 * Simplified sheet showing ONLY:
 * - Avatar (large)
 * - Name
 * - Surname
 *
 * Same as PNG for now, but separate component because fields may diverge.
 *
 * @module components/windows/contents/CharacterSheetMaster
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/character/SimplifiedCharacterSheet.module.scss';

interface CharacterSheetMasterProps {
  character: {
    _id: string;
    name: string;
    surname?: string;
    avatar?: string;
  };
}

export function CharacterSheetMaster({ character }: CharacterSheetMasterProps): JSX.Element {
  return (
    <div className={styles.masterSheet}>
      <div className={styles.avatarLarge}>
        <img
          src={character.avatar || '/images/default-avatar.png'}
          alt={character.name}
        />
      </div>
      <h1 className={styles.characterName}>
        {character.name} {character.surname || ''}
      </h1>
    </div>
  );
}
