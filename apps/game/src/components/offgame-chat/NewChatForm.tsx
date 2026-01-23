import React, { useState, useEffect } from 'react';
import styles from './NewChatForm.module.scss';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface Character {
  id: string;
  name: string;
  surname?: string;
  avatar?: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED';
  isOwnCharacter: boolean;
  isOnline: boolean;
}

interface NewChatFormProps {
  type: 'direct' | 'group';
  onSubmit: (data: { type: 'direct' | 'group'; name?: string; participants: string[] }) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const NewChatForm: React.FC<NewChatFormProps> = ({
  type,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [groupName, setGroupName] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [availableCharacters, setAvailableCharacters] = useState<Character[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingCharacters, setLoadingCharacters] = useState(false);

  // Fetch available characters for chat
  useEffect(() => {
    const fetchCharacters = async () => {
      setLoadingCharacters(true);
      try {
        const response = await fetch(`${API_BASE_URL}/game/characters/public-list`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.result) {
            // Filter out current user's characters (isOwnCharacter: true)
            const characters = data.data?.characters || data.list || [];
            const filteredCharacters = characters.filter(
              (character: Character) => !character.isOwnCharacter
            );
            setAvailableCharacters(filteredCharacters);
          }
        }
      } catch (error) {
        console.error('Error fetching characters:', error);
      } finally {
        setLoadingCharacters(false);
      }
    };

    fetchCharacters();
  }, []);

  const handleParticipantToggle = (characterId: string) => {
    setSelectedParticipants(prev => {
      if (prev.includes(characterId)) {
        return prev.filter(id => id !== characterId);
      } else {
        // For direct chat, limit to 1 participant
        if (type === 'direct') {
          return [characterId];
        }
        // For group chat, limit to 4 additional participants (5 total with creator)
        if (prev.length < 4) {
          return [...prev, characterId];
        }
        return prev;
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedParticipants.length === 0) {
      alert('Seleziona almeno un partecipante');
      return;
    }

    if (type === 'group' && !groupName.trim()) {
      alert('Il nome del gruppo è obbligatorio');
      return;
    }

    if (type === 'direct' && selectedParticipants.length !== 1) {
      alert('Le chat dirette devono avere esattamente un partecipante');
      return;
    }

    if (type === 'group' && selectedParticipants.length > 4) {
      alert('I gruppi possono avere massimo 5 partecipanti (incluso te)');
      return;
    }

    onSubmit({
      type,
      name: type === 'group' ? groupName.trim() : undefined,
      participants: selectedParticipants
    });
  };

  const filteredCharacters = availableCharacters.filter(character =>
    character.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (character.surname && character.surname.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getCharacterDisplayName = (character: Character) => {
    return character.surname ? `${character.name} ${character.surname}` : character.name;
  };

  const getStatusBadgeColor = (status: Character['status']) => {
    switch (status) {
      case 'APPROVED': return '#90ee90';
      case 'PENDING_APPROVAL': return '#ffa500';
      case 'DRAFT': return '#696969';
      default: return '#696969';
    }
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.formContainer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            {type === 'direct' ? '👤 Nuova Chat Diretta' : '👥 Nuovo Gruppo'}
          </h3>
          <button className={styles.closeButton} onClick={onCancel}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Group name field (only for groups) */}
          {type === 'group' && (
            <div className={styles.formGroup}>
              <label htmlFor="groupName" className={styles.label}>
                Nome del Gruppo *
              </label>
              <input
                id="groupName"
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className={styles.input}
                placeholder="Es: Investigatori di Whitechapel"
                maxLength={100}
                required
              />
            </div>
          )}

          {/* Participants selection */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Partecipanti * 
              <span className={styles.counter}>
                ({selectedParticipants.length}/{type === 'direct' ? 1 : 4} selezionati)
              </span>
            </label>

            {/* Search filter */}
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
              placeholder="Cerca personaggi..."
            />

            {/* Characters list */}
            <div className={styles.charactersList}>
              {loadingCharacters ? (
                <div className={styles.loading}>Caricamento personaggi...</div>
              ) : filteredCharacters.length === 0 ? (
                <div className={styles.emptyState}>
                  {searchTerm ? 'Nessun personaggio trovato' : 'Nessun personaggio disponibile'}
                </div>
              ) : (
                filteredCharacters.map(character => (
                  <div
                    key={character.id}
                    className={`${styles.characterItem} ${
                      selectedParticipants.includes(character.id) ? styles.selected : ''
                    }`}
                    onClick={() => handleParticipantToggle(character.id)}
                  >
                    <div className={styles.characterInfo}>
                      <div className={styles.characterName}>
                        {getCharacterDisplayName(character)}
                      </div>
                      <div
                        className={styles.statusBadge}
                        style={{ backgroundColor: getStatusBadgeColor(character.status) }}
                      >
                        {character.status === 'APPROVED' ? 'Approvato' : 
                         character.status === 'PENDING_APPROVAL' ? 'In Approvazione' : 'Bozza'}
                      </div>
                    </div>
                    {selectedParticipants.includes(character.id) && (
                      <div className={styles.selectedIcon}>✓</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className={styles.actions}>
            <button
              type="button"
              onClick={onCancel}
              className={styles.cancelButton}
              disabled={loading}
            >
              Annulla
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading || selectedParticipants.length === 0}
            >
              {loading ? 'Creazione...' : `Crea ${type === 'direct' ? 'Chat' : 'Gruppo'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};