/**
 * Character Sheet for PNG (Personaggi Non Giocanti)
 *
 * Simplified sheet showing ONLY:
 * - Avatar (large)
 * - Name
 * - Surname
 *
 * No tabs, no stats, no equipment.
 *
 * @module components/windows/contents/CharacterSheetPNG
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/character/SimplifiedCharacterSheet.module.scss';

interface CharacterSheetPNGProps {
  character: {
    _id: string;
    name: string;
    surname?: string;
    avatar?: string;
  };
}

export function CharacterSheetPNG({ character }: CharacterSheetPNGProps): JSX.Element {
  return (
    <div className={styles.pngSheet}>
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
