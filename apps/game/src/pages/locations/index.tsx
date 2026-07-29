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
import { useState } from 'react';

import { GameLayout } from '@/components/layout/GameLayout';
import { LocationsErrorBoundary } from '@/components/locations/LocationsErrorBoundary';
import { LocationsList } from '@/components/locations/LocationsList';
import { LocationsMap } from '@/components/locations/LocationsMap';
import { ViewModeSelector, ViewMode } from '@/components/locations/ViewModeSelector';
import { useLocations } from '@/hooks/useLocations';
import styles from '@/styles/pages/locations.module.scss';

/**
 * Locations Page Component
 *
 * Renders the main locations page with view mode selector and content.
 *
 * @component
 * @returns {JSX.Element} Locations page
 */
export default function LocationsPage(): JSX.Element {
  const router = useRouter();
  const { locations, locationTree, isLoading, error } = useLocations();

  // View mode from URL query param, default to 'mappa'
  const initialViewMode = (router.query.view as ViewMode) || 'mappa';
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);

  /**
   * Handle view mode change
   * Updates URL query param for shareable links
   */
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    router.push(
      {
        pathname: '/locations',
        query: { view: mode },
      },
      undefined,
      { shallow: true }
    );
  };

  /**
   * Handle district click
   * Navigates to district detail page with split-panel
   * Uses slug for SEO-friendly URLs
   */
  const handleDistrictClick = (slug: string) => {
    router.push(`/locations/${slug}`);
  }; 

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
            {/* View Mode Selector (Floating Top-Left) */}
            <ViewModeSelector mode={viewMode} onChange={handleViewModeChange} />

            {/* Map View */}
            {viewMode === 'mappa' && (
              <LocationsMap
                locations={locations}
                onDistrictClick={handleDistrictClick} 
              />
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
