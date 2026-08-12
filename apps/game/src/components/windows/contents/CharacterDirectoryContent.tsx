/**
 * Character Directory Content Component
 *
 * Displays complete character directory (anagrafica) with:
 * - All approved characters
 * - Online status indicators
 * - Face claims (prestavolti)
 * - Occupations and last presence
 * - Search and filters
 * - Click to open character sheet
 *
 * @module components/windows/contents/CharacterDirectoryContent
 * @since 2.0.0
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import React from 'react';

import { useCharacterDirectory, type CharacterDirectoryFilters } from '@/hooks/useCharacterDirectory';
import { characterApi } from '@/lib/api/character';
import { useWindowManagerStore } from '@/store/windowManagerStore';
import styles from '@/styles/components/windows/CharacterDirectory.module.scss';

/**
 * Format relative time (e.g., "2 minuti fa", "3 ore fa")
 */
function formatRelativeTime(isoDate: string | undefined): string {
  if (!isoDate) return 'Mai';

  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Ora';
  if (diffMinutes < 60) return `${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minuti'} fa`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'ora' : 'ore'} fa`;
  if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'giorno' : 'giorni'} fa`;

  return date.toLocaleDateString('it-IT', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Character Directory Content Component
 *
 * @returns {JSX.Element} Character directory table
 */
export function CharacterDirectoryContent(): JSX.Element {
  const { openWindow } = useWindowManagerStore();

  // Filters state
  const [filters, setFilters] = React.useState<CharacterDirectoryFilters>({
    search: '',
    onlineOnly: false,
    occupation: '',
    page: 1,
    limit: 25
  });

  // Debounced search
  const [searchInput, setSearchInput] = React.useState('');
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch data (auto-refetch every 30s for online status)
  const { data, isLoading, error } = useCharacterDirectory(filters);

  // Fetch occupations list for filter dropdown
  const { data: occupations = [] } = useQuery({
    queryKey: ['occupations'],
    queryFn: characterApi.getOccupations,
    staleTime: 5 * 60 * 1000, // Cache 5 minutes (occupations rarely change)
  });

  /**
   * Handle character row click → open character sheet window
   */
  const handleCharacterClick = (e: React.MouseEvent, characterId: string, characterName: string, avatar?: string) => {
    e.stopPropagation(); // Prevent click from bubbling to window (which would refocus directory)
    openWindow('characterSheet', {
      characterId,
      characterName,
      avatar
    });
  };

  /**
   * Handle page change
   */
  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div className={styles.directoryContainer}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>📖 Anagrafica Personaggi</h2>
        <p className={styles.subtitle}>
          Elenco completo di tutti i personaggi approvati · Aggiornamento automatico ogni 30 secondi
        </p>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        {/* Search */}
        <div className={styles.filterGroup}>
          <label htmlFor="search" className={styles.filterLabel}>
            Cerca per nome:
          </label>
          <input
            type="text"
            id="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="es. mario_rossi"
            className={styles.searchInput}
          />
        </div>

        {/* Online Only Toggle */}
        <div className={styles.filterGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={filters.onlineOnly || false}
              onChange={(e) => setFilters((prev) => ({ ...prev, onlineOnly: e.target.checked, page: 1 }))}
              className={styles.checkbox}
            />
            <span>Solo personaggi online</span>
          </label>
        </div>

        {/* Occupation Filter */}
        <div className={styles.filterGroup}>
          <label htmlFor="occupation" className={styles.filterLabel}>
            Occupazione:
          </label>
          <select
            id="occupation"
            value={filters.occupation || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, occupation: e.target.value, page: 1 }))}
            className={styles.select}
          >
            <option value="">Tutte</option>
            {occupations.map((occ) => (
              <option key={occ._id} value={occ.name}>
                {occ.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Caricamento personaggi in corso...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className={styles.errorState}>
          <p>⚠️ Errore nel caricamento dell'anagrafica. Riprova più tardi.</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && data && (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thAvatar}>Avatar</th>
                  <th className={styles.thName}>Nome</th>
                  <th className={styles.thPrestavolto}>Prestavolto</th>
                  <th className={styles.thOccupation}>Occupazione</th>
                  <th className={styles.thStatus}>Status</th>
                  <th className={styles.thLastActive}>Ultima Presenza</th>
                  <th className={styles.thLocation}>Luogo Attuale</th>
                </tr>
              </thead>
              <tbody>
                {data.characters.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.emptyState}>
                      Nessun personaggio trovato con i filtri selezionati.
                    </td>
                  </tr>
                ) : (
                  data.characters.map((character) => (
                    <tr
                      key={character._id}
                      onClick={(e) =>
                        handleCharacterClick(e, character._id, character.name, character.avatar)
                      }
                      className={styles.row}
                    >
                      {/* Avatar */}
                      <td className={styles.tdAvatar}>
                        {character.avatar ? (
                          <img src={character.avatar} alt={character.name} className={styles.avatar} />
                        ) : (
                          <div className={styles.avatarPlaceholder}>
                            {character.name.charAt(0)}
                          </div>
                        )}
                      </td>

                      {/* Name */}
                      <td className={styles.tdName}>
                        <div className={styles.nameCell}>
                          <span className={styles.fullName}>
                            {character.name}
                          </span>
                        </div>
                      </td>

                      {/* Prestavolto */}
                      <td className={styles.tdPrestavolto}>{character.prestavolto || '—'}</td>

                      {/* Occupation */}
                      <td className={styles.tdOccupation}>{character.currentOccupation || '—'}</td>

                      {/* Status */}
                      <td className={styles.tdStatus}>
                        {character.isOnline ? (
                          <span className={styles.statusOnline}>
                            <span className={styles.statusDot}></span>
                            Online
                          </span>
                        ) : (
                          <span className={styles.statusOffline}>
                            <span className={styles.statusDot}></span>
                            Offline
                          </span>
                        )}
                      </td>

                      {/* Last Active */}
                      <td className={styles.tdLastActive}>{formatRelativeTime(character.lastActive)}</td>

                      {/* Current Location */}
                      <td className={styles.tdLocation}>{character.currentLocation?.name || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.total > (filters.limit || 25) && (
            <div className={styles.pagination}>
              <button
                onClick={() => handlePageChange((filters.page || 1) - 1)}
                disabled={(filters.page || 1) === 1}
                className={styles.paginationButton}
              >
                ← Precedente
              </button>

              <span className={styles.paginationInfo}>
                Pagina {filters.page || 1} di {Math.ceil(data.total / (filters.limit || 25))} · {data.total}{' '}
                personaggi totali
              </span>

              <button
                onClick={() => handlePageChange((filters.page || 1) + 1)}
                disabled={(filters.page || 1) >= Math.ceil(data.total / (filters.limit || 25))}
                className={styles.paginationButton}
              >
                Successiva →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
