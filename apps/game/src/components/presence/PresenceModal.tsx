'use client';

import { useEffect, useCallback, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { usePresenceStore } from '@/store/presenceStore';
import { useWindowManagerStore } from '@/store/windowManagerStore';
import styles from '@/styles/components/presence/PresenceModal.module.scss';

const ANIMATION_DURATION = 300; // ms

export function PresenceModal(): JSX.Element | null {
  const router = useRouter();
  const { isModalOpen, closeModal, globalPresence } = usePresenceStore();
  const { openWindow } = useWindowManagerStore();
  const [isClosing, setIsClosing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');


  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      closeModal();
      setIsClosing(false);
      setSearchQuery(''); // Reset search on close
    }, ANIMATION_DURATION);
  }, [closeModal]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    },
    [handleClose]
  );

  useEffect(() => {
    if (isModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isModalOpen, handleKeyDown]);

  // Filter presence by search query
  const filteredPresence = useMemo(() => {
    if (!searchQuery.trim()) return globalPresence || [];

    const query = searchQuery.toLowerCase();
    return (globalPresence || []).filter((p) => {
      const fullName = `${p.characterName} ${p.characterSurname || ''}`.toLowerCase();
      return fullName.includes(query);
    });
  }, [globalPresence, searchQuery]);

  const handleAvatarClick = useCallback((characterId: string, characterName: string, characterSurname: string | undefined, avatar: string | undefined) => {
    // Open character sheet WITHOUT closing the modal
    const fullName = characterSurname ? `${characterName} ${characterSurname}` : characterName;
    openWindow('characterSheet', {
      characterId,
      characterName: fullName,
      avatar,
    });
  }, [openWindow]);

  const handleLocationClick = (locationSlug: string, _locationName: string) => {
    if (!locationSlug) {
      // London (no specific location chat)
      return;
    }
    // Navigate to location chat: /locations/{slug}/chat
    router.push(`/locations/${locationSlug}/chat`);
  };

  if (!isModalOpen) return null;

  return (
    <div
      className={`${styles.overlay} ${isClosing ? styles.closing : ''}`}
      onClick={handleOverlayClick}
    >
      <div
        className={`${styles.modal} ${isClosing ? styles.closing : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Presenti Online"
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Presenti Online ({filteredPresence.length})</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Chiudi presenze"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div className={styles.search}>
          <input
            type="text"
            placeholder="Cerca personaggio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            aria-label="Cerca personaggio per nome"
          />
        </div>

        {/* Flat List */}
        <div className={styles.content}>
          {filteredPresence.length === 0 ? (
            <div className={styles.empty}>
              {searchQuery
                ? 'Nessun personaggio trovato'
                : 'Nessuno online al momento'}
            </div>
          ) : (
            <ul className={styles.list} role="list">
              {filteredPresence.map((presence) => (
                <li key={presence.characterId} className={styles.item} role="listitem">
                  {/* Avatar + Name */}
                  <div className={styles.itemMain}>
                    <button
                      type="button"
                      className={styles.avatarButton}
                      onClick={() => handleAvatarClick(
                        presence.characterId,
                        presence.characterName,
                        presence.characterSurname ?? undefined,
                        presence.avatar ?? undefined
                      )}
                      aria-label={`Apri scheda di ${presence.characterName}${presence.characterSurname ? ` ${presence.characterSurname}` : ''}`}
                    >
                      <img
                        src={presence.avatar || '/images/sidebar/miniavatar_default.png'}
                        onError={(e) => {
                          e.currentTarget.src = '/images/sidebar/miniavatar_default.png';
                        }}
                        alt=""
                        aria-hidden="true"
                        className={styles.avatar}
                      />
                    </button>
                    <div className={styles.info}>
                      <div className={styles.name}>
                        {presence.characterName}
                        {presence.characterSurname && ` ${presence.characterSurname}`}
                      </div>
                    </div>
                  </div>

                  {/* Location (clickable, bottom left) */}
                  {presence.locationSlug && (
                    <button
                      type="button"
                      className={styles.locationButton}
                      onClick={() => handleLocationClick(presence.locationSlug, presence.locationName)}
                      aria-label={`Apri chat di ${presence.locationName}`}
                    >
                      📍 {presence.locationName}
                    </button>
                  )}
                  {!presence.locationSlug && (
                    <div className={styles.locationText}>📍 Londra</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
