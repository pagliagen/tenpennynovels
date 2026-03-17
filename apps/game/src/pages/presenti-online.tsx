/**
 * Presenti Online Page
 *
 * Full page view showing ALL online characters with real-time updates.
 * Displays characters grouped by location (current, London, other).
 *
 * Features:
 * - Real-time updates via WebSocket (global_presence_update)
 * - Search by character name
 * - Filter by location
 * - Highlight characters in same location as current character
 * - "STANZA PRIVATA" indicator for private locations
 *
 * @module pages/presenti-online
 * @since 2.0.0
 */

'use client';

import { useState, useMemo } from 'react';
import Head from 'next/head';
import { GameLayout } from '@/components/layout/GameLayout';
import { usePresence } from '@/hooks/usePresence';
import { useGameStateStore } from '@/store/gameStateStore';
import { useWindowManagerStore } from '@/store/windowManagerStore';
// @ts-ignore - Used as type in PresenceGroupProps below
import { type GlobalPresence } from '@/store/presenceStore';
import styles from '@/styles/pages/presenti-online.module.scss';

/**
 * Presenti Online Page Component
 *
 * Renders full presence list with search, filter, and grouping.
 *
 * @component
 * @returns {JSX.Element} Presenti online page
 * @since 2.0.0
 */
export default function PresentiOnlinePage(): JSX.Element {
  const { globalPresence, isLoading } = usePresence();
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string | null>(null);

  // Get current character's location (SINGLE SOURCE OF TRUTH from GameStateStore)
  const currentLocationId = useGameStateStore((state) => state.currentLocationId) || '';

  // Filter and group presence data
  const groupedPresence = useMemo(() => {
    // Defensive: ensure globalPresence is an array
    const presenceList = globalPresence || [];

    // Apply search filter
    let filtered = presenceList.filter((p) => {
      const fullName = `${p.characterName} ${p.characterSurname || ''}`.toLowerCase();
      return fullName.includes(searchQuery.toLowerCase());
    });

    // Apply location filter
    if (locationFilter) {
      filtered = filtered.filter((p) => p.locationId === locationFilter);
    }

    // Group by location
    const sameLocation = filtered.filter(
      (p) => p.locationId === currentLocationId
    );
    const london = filtered.filter(
      (p) => p.locationId === ''
    );
    const otherLocations = filtered.filter(
      (p) => p.locationId !== currentLocationId && p.locationId !== ''
    );

    return { sameLocation, london, otherLocations };
  }, [globalPresence, searchQuery, locationFilter, currentLocationId]);

  // Get unique locations for filter dropdown
  const uniqueLocations = useMemo(() => {
    const locations = new Map<string, string>();
    // Defensive: ensure globalPresence is an array
    const presenceList = globalPresence || [];
    presenceList.forEach((p) => {
      if (!locations.has(p.locationId)) {
        locations.set(p.locationId, p.locationName);
      }
    });
    return Array.from(locations.entries());
  }, [globalPresence]);

  if (isLoading) {
    return (
      <>
        <Head>
          <title>Ten Penny Novels | Presenti Online</title>
          <meta name="description" content="Vedi chi è online ora su Ten Penny Novels. Trova altri giocatori nella Londra Vittoriana e unisciti alle loro avventure." />
        </Head>
        <GameLayout>
          <div className={styles.presencePage}>
            <div className={styles.loading}>Caricamento presenza online...</div>
          </div>
        </GameLayout>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Ten Penny Novels | Presenti Online</title>
        <meta name="description" content="Vedi chi è online ora su Ten Penny Novels. Trova altri giocatori nella Londra Vittoriana e unisciti alle loro avventure." />
      </Head>
      <GameLayout>
        <div className={styles.presencePage}>
          {/* Header */}
          <header className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Presenti Online ({globalPresence.length})</h1>
          </header>

        {/* Filters */}
        <div className={styles.filters}>
          <input
            type="text"
            placeholder="Cerca personaggio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            aria-label="Cerca personaggio per nome"
          />

          <select
            value={locationFilter || ''}
            onChange={(e) => setLocationFilter(e.target.value || null)}
            className={styles.locationFilter}
            aria-label="Filtra per location"
          >
            <option value="">Tutte le location</option>
            {uniqueLocations.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Grouped Lists */}
        <div className={styles.groupsContainer}>
          {/* Same Location Group (Highlighted) */}
          {groupedPresence.sameLocation.length > 0 && (
            <PresenceGroup
              title={`In questa location (${groupedPresence.sameLocation.length})`}
              players={groupedPresence.sameLocation}
              highlight
            />
          )}

          {/* London Group */}
          {groupedPresence.london.length > 0 && (
            <PresenceGroup
              title={`A Londra (${groupedPresence.london.length})`}
              players={groupedPresence.london}
            />
          )}

          {/* Other Locations Group */}
          {groupedPresence.otherLocations.length > 0 && (
            <PresenceGroup
              title={`In altre location (${groupedPresence.otherLocations.length})`}
              players={groupedPresence.otherLocations}
            />
          )}

          {/* Empty State */}
          {groupedPresence.sameLocation.length === 0 &&
            groupedPresence.london.length === 0 &&
            groupedPresence.otherLocations.length === 0 && (
              <div className={styles.emptyState}>
                {searchQuery || locationFilter
                  ? 'Nessun personaggio trovato con i filtri selezionati'
                  : 'Nessuno online al momento'}
              </div>
            )}
        </div>
      </div>
    </GameLayout>
    </>
  );
}

/**
 * Presence Group Component
 *
 * Renders a group of characters (same location, London, other locations).
 */
interface PresenceGroupProps {
  title: string;
  players: GlobalPresence[];
  highlight?: boolean;
}

function PresenceGroup({ title, players, highlight = false }: PresenceGroupProps): JSX.Element {
  const { openWindow } = useWindowManagerStore();

  return (
    <section className={styles.presenceGroup} aria-label={title}>
      <h2 className={styles.groupHeader}>{title}</h2>

      <ul className={styles.groupList} role="list">
        {players.map((presence) => (
          <li
            key={presence.characterId}
            className={`${styles.playerItem} ${highlight ? styles.highlighted : ''}`}
            role="listitem"
          >
            <button
              type="button"
              className={styles.playerButton}
              aria-label={`${presence.characterName}${
                presence.characterSurname ? ' ' + presence.characterSurname : ''
              }, in ${presence.locationName}. Clicca per profilo`}
              onClick={() => {
                openWindow('characterSheet', {
                  characterId: presence.characterId,
                  characterName: presence.characterName,
                  avatar: presence.avatar || undefined,
                });
              }}
            >
              {/* Avatar */}
              <img
                src={presence.avatar || '/images/sidebar/miniavatar_default.png'}
                onError={(e) => {
                  e.currentTarget.src = '/images/sidebar/miniavatar_default.png';
                }}
                alt=""
                aria-hidden="true"
                className={styles.playerAvatar}
              />

              {/* Info */}
              <div className={styles.playerInfo}>
                <div className={styles.playerName}>
                  {presence.characterName}
                  {presence.characterSurname && ` ${presence.characterSurname}`}
                </div>

                <div
                  className={`${styles.playerLocation} ${
                    presence.locationName === 'STANZA PRIVATA' ? styles.private : ''
                  }`}
                >
                  {presence.locationName === '' ? 'Londra' : presence.locationName}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
