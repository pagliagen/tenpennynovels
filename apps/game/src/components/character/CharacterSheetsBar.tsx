import React from 'react';
import styles from './CharacterSheetsBar.module.scss';
import { useCharacterSheets } from '../../contexts/CharacterSheetsContext';

const CharacterSheetsBar: React.FC = () => {
  const { openSheets, restoreCharacterSheet, closeCharacterSheet } = useCharacterSheets();
  
  const minimizedSheets = openSheets.filter(sheet => sheet.isMinimized);
  
  if (minimizedSheets.length === 0) return null;

  return (
    <div className={styles.characterSheetsBar}>
      <div className={styles.sheetsContainer}>
        {minimizedSheets.map(sheet => (
          <div 
            key={sheet.id}
            className={styles.minimizedSheet}
            onClick={() => restoreCharacterSheet(sheet.id)}
          >
            {sheet.avatar ? (
              <img 
                src={sheet.avatar} 
                alt={sheet.characterName}
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatarPlaceholder}>
                {sheet.characterName.charAt(0).toUpperCase()}
              </div>
            )}
            
            <span className={styles.characterName}>
              {sheet.characterName}
            </span>
            
            <button 
              className={styles.closeButton}
              onClick={(e) => {
                e.stopPropagation();
                closeCharacterSheet(sheet.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CharacterSheetsBar;