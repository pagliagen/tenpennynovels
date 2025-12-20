import React, { useState, useEffect } from 'react';
import styles from '@/styles/components/CharacterListView.module.scss';
import { useCharacterSheets } from '@/contexts/CharacterSheetsContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface PublicCharacter {
  id: string;
  name: string;
  surname: string | null;
  avatar: string | null;
  status: string;
  isOwnCharacter: boolean;
  isOnline: boolean;
}

interface CharacterListViewProps {
  // Props se necessarie per future estensioni
}

export const CharacterListView: React.FC<CharacterListViewProps> = () => {
  const [characters, setCharacters] = useState<PublicCharacter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [excludeOwnCharacters, setExcludeOwnCharacters] = useState(true);
  
  const { openCharacterSheet } = useCharacterSheets();

  // Handle character click to open character sheet
  const handleCharacterClick = (character: PublicCharacter) => {
    openCharacterSheet(
      character.id,
      character.name,
      character.avatar || undefined
    );
  };

  // Fetch characters data
  const fetchCharacters = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/game/characters/public-list`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Errore nel caricamento dei personaggi');
        return;
      }

      if (data.success) {
        setCharacters(data.data.characters);
      } else {
        setError('Errore nel caricamento dei personaggi');
      }
    } catch (err) {
      console.error('Error fetching characters:', err);
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  // Load characters on component mount
  useEffect(() => {
    fetchCharacters();
  }, []);

  // Filter characters based on selected filters
  const filteredCharacters = characters.filter(character => {
    if (showOnlineOnly && !character.isOnline) return false;
    if (excludeOwnCharacters && character.isOwnCharacter) return false;
    return true;
  });

  const onlineCount = characters.filter(c => c.isOnline).length;
  const totalCount = characters.length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Lista Personaggi</h1>
        <div className={styles.stats}>
          <span className={styles.statItem}>
            <span className={styles.onlineDot}>●</span>
            {onlineCount} online
          </span>
          <span className={styles.statItem}>
            {totalCount} totali
          </span>
        </div>
      </div>

      <div className={styles.filters}>
        <label className={styles.filterItem}>
          <input
            type="checkbox"
            checked={showOnlineOnly}
            onChange={(e) => setShowOnlineOnly(e.target.checked)}
          />
          <span>Solo online</span>
        </label>
        
        <label className={styles.filterItem}>
          <input
            type="checkbox"
            checked={excludeOwnCharacters}
            onChange={(e) => setExcludeOwnCharacters(e.target.checked)}
          />
          <span>Escludi miei personaggi</span>
        </label>
      </div>

      <div className={styles.content}>
        {loading && (
          <div className={styles.loading}>Caricamento...</div>
        )}

        {error && (
          <div className={styles.error}>
            {error}
            <button onClick={fetchCharacters} className={styles.retryButton}>
              Riprova
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className={styles.charactersList}>
            {filteredCharacters.length === 0 ? (
              <div className={styles.noCharacters}>
                Nessun personaggio trovato con i filtri selezionati
              </div>
            ) : (
              filteredCharacters.map(character => (
                <div 
                  key={character.id} 
                  className={`${styles.characterItem} ${character.isOnline ? styles.online : styles.offline}`}
                  onClick={() => handleCharacterClick(character)}
                >
                  <div className={styles.characterAvatar}>
                    {character.avatar ? (
                      <img src={character.avatar} alt={character.name} />
                    ) : (
                      <div className={styles.defaultAvatar}>
                        {character.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  <div className={styles.characterInfo}>
                    <div className={styles.characterName}>
                      {character.name}
                      {character.surname && ` ${character.surname}`}
                    </div>
                    <div className={styles.characterStatus}>
                      <span className={`${styles.statusDot} ${character.isOnline ? styles.online : styles.offline}`}>
                        ●
                      </span>
                      {character.isOnline ? 'Online' : 'Offline'}
                      {character.isOwnCharacter && (
                        <span className={styles.ownCharacterBadge}>Mio</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};