/**
 * Locations Main Page
 *
 * Main entry point for the locations/map system.
 * Provides three view modes:
 * - Mappa: Interactive London map with clickable districts
 * - Testuale: Expandable tree list of all locations
 * - Appartamenti: Private apartments (future feature)
 *
 * @module pages/locations
 * @since 2.0.0
 */

'use client';

import Head from 'next/head';
import { useRouter } from 'next/router';

import { GameLayout } from '@/components/layout/GameLayout';
import { LocationsErrorBoundary } from '@/components/locations/LocationsErrorBoundary';
import { LocationsList } from '@/components/locations/LocationsList';
import { LocationsMap } from '@/components/locations/LocationsMap';
import { useLocations } from '@/hooks/useLocations';
import styles from '@/styles/pages/locations.module.scss';

type ViewMode = 'mappa' | 'testuale';

/**
 * Locations Page Component
 *
 * Renders the main locations page (map or list view based on the `view` query param).
 *
 * @component
 * @returns {JSX.Element} Locations page
 */
export default function LocationsPage(): JSX.Element {
  const router = useRouter();
  const { locations, locationTree, isLoading, error } = useLocations();

  // View mode from URL query param, default to 'mappa'
  const viewMode = (router.query.view as ViewMode) || 'mappa';

  // Loading state
  if (isLoading && locations.length === 0) {
    return (
      <>
        <Head>
          <title>Ten Penny Novels | Mappa di Londra</title>
          <meta name="description" content="Esplora la mappa interattiva della Londra Vittoriana del 1890. Scopri distretti, locations e luoghi nascosti nel gioco di ruolo Ten Penny Novels." />
        </Head>
        <GameLayout>
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p className={styles.loadingText}>Caricamento locations...</p>
          </div>
        </GameLayout>
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Head>
          <title>Ten Penny Novels | Mappa di Londra</title>
          <meta name="description" content="Esplora la mappa interattiva della Londra Vittoriana del 1890. Scopri distretti, locations e luoghi nascosti nel gioco di ruolo Ten Penny Novels." />
        </Head>
        <GameLayout>
          <div className={styles.errorContainer}>
            <h2 className={styles.errorTitle}>Errore</h2>
            <p className={styles.errorMessage}>{error}</p>
            <button
              className={styles.retryButton}
              onClick={() => window.location.reload()}
            >
              Riprova
            </button>
          </div>
        </GameLayout>
      </>
    );
  }

  // Empty state (no locations accessible)
  if (locations.length === 0) {
    return (
      <>
        <Head>
          <title>Ten Penny Novels | Mappa di Londra</title>
          <meta name="description" content="Esplora la mappa interattiva della Londra Vittoriana del 1890. Scopri distretti, locations e luoghi nascosti nel gioco di ruolo Ten Penny Novels." />
        </Head>
        <GameLayout>
          <div className={styles.emptyContainer}>
            <h2 className={styles.emptyTitle}>Nessuna Location Disponibile</h2>
            <p className={styles.emptyMessage}>
              Non hai accesso a nessuna location al momento.
            </p>
          </div>
        </GameLayout>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Ten Penny Novels | Mappa di Londra</title>
        <meta name="description" content="Esplora la mappa interattiva della Londra Vittoriana del 1890. Scopri distretti, locations e luoghi nascosti nel gioco di ruolo Ten Penny Novels." />
      </Head>
      <GameLayout>
        <LocationsErrorBoundary>
          <div className={styles.locationsPage}>
            {/* Map View */}
            {viewMode === 'mappa' && (
              <LocationsMap locations={locations} />
            )}

            {/* Textual/List View */}
            {viewMode === 'testuale' && (
              <LocationsList locationTree={locationTree} />
            )}
          </div>
        </LocationsErrorBoundary>
      </GameLayout>
    </>
  );
}
