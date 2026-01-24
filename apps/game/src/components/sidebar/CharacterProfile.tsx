import React from 'react';
import { useRouter } from 'next/router';
import { useGame } from '@/contexts/GameContext';
import { useCharacterSheets } from '@/contexts/CharacterSheetsContext';
import styles from '@/styles/components/sidebar/CharacterProfile.module.scss';

export const CharacterProfile: React.FC = () => {
  const { character } = useGame();
  const { openCharacterSheet } = useCharacterSheets();
  const router = useRouter();

  if (!character) {
    return null;
  }

  const avatarUrl = character.avatar || '/images/sidebar/avatar-default.png';
  const characterName = character.name || 'Nome Personaggio';
  const characterSurname = character.surname || '';

  const handleProfileClick = () => {
    // If character is DRAFT, navigate to wizard
    if (character.status === 'DRAFT') {
      router.push('/character/wizard');
      return;
    }

    // Otherwise open character sheet
    openCharacterSheet(
      character.id,
      characterName,
      character.avatar || undefined,
      character.audioTheme,
      character
    );
  };

  return (
    <div 
      className={styles.characterProfile}
      onClick={handleProfileClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleProfileClick();
        }
      }}
    >
      <div className={styles.avatarContainer}>
        <img 
          src="/images/sidebar/avatar-frame.png" 
          alt="Avatar frame" 
          className={styles.avatarFrame}
        />
        <img 
          src={avatarUrl} 
          alt={characterName}
          className={styles.avatarImage}
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/images/sidebar/avatar-default.png';
          }}
        />
      </div>
      <div className={styles.characterName}>
        {characterName}
        {characterSurname && ` ${characterSurname}`}
      </div>
    </div>
  );
};

