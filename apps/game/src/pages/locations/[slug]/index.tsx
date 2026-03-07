/**
 * Location Detail Page (Slug-Based)
 *
 * Standalone page for viewing a specific location and its subtree.
 * Reuses DistrictView component for consistent UX.
 *
 * URL: /locations/[slug] (e.g., /locations/westminster)
 *
 * Features:
 * - Split-panel layout (reuses DistrictView)
 * - Shows complete subtree of location
 * - Back button to return to map
 * - "Entra In Chat" button navigates to /locations/[slug]/chat
 *
 * @module pages/locations/[slug]
 * @since 2.0.0
 */

'use client';

import { useRouter } from 'next/router';
import Head from 'next/head';
import { GameLayout } from '@/components/layout/GameLayout';
import { DistrictView } from '@/components/locations/DistrictView';
import { LocationsErrorBoundary } from '@/components/locations/LocationsErrorBoundary';
import { useLocationTreeNodeBySlug } from '@/hooks/useLocations';
import styles from '@/styles/pages/locations.module.scss';

/**
 * Location Detail Page Component
 *
 * Renders a specific location with split-panel view.
 *
 * @component
 * @returns {JSX.Element} Location detail page
 */
export default function LocationDetailPage(): JSX.Element {
  const router = useRouter();
  const { slug } = router.query; // Slug from URL (e.g., "westminster")

  // Fetch location from tree (with children populated)
  const { location, isLoading } = useLocationTreeNodeBySlug(slug as string);

  /**
   * Handle back button click
   * Returns to main locations page (map view)
   */
  const handleBack = () => {
    router.push('/locations');
  };

  // Loading state
  if (isLoading || !slug) {
    return (
      <>
        <Head>
          <title>Location - Ten Penny Novels</title>
          <meta name="description" content="Esplora le locations della Londra Vittoriana su Ten Penny Novels." />
        </Head>
        <GameLayout>
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p className={styles.loadingText}>Caricamento location...</p>
          </div>
        </GameLayout>
      </>
    );
  }

  // Location not found
  if (!location) {
    return (
      <>
        <Head>
          <title>Location Non Trovata - Ten Penny Novels</title>
          <meta name="description" content="La location che cerchi non esiste o non è accessibile." />
        </Head>
        <GameLayout>
          <div className={styles.errorContainer}>
            <h2 className={styles.errorTitle}>Location Non Trovata</h2>
            <p className={styles.errorMessage}>
              La location richiesta non esiste o non hai accesso ad essa.
            </p>
            <button className={styles.retryButton} onClick={handleBack}>
              Torna alla Mappa
            </button>
          </div>
        </GameLayout>
      </>
    );
  }

  // Render location with split-panel view
  return (
    <>
      <Head>
        <title>{location.name} - Ten Penny Novels</title>
        <meta name="description" content={`Esplora ${location.name} nella Londra Vittoriana. ${location.description || 'Scopri misteri e avventure in questa location del gioco Ten Penny Novels.'}`} />
      </Head>
      <GameLayout>
        <LocationsErrorBoundary>
          <div className={styles.locationsPage}>
            <DistrictView district={location} onBack={handleBack} />
          </div>
        </LocationsErrorBoundary>
      </GameLayout>
    </>
  );
}
