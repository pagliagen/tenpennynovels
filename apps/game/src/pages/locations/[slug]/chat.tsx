/**
 * Location Chat Page
 *
 * Dynamic route for location chat: /locations/{slug}/chat
 *
 * Features:
 * - Slug-based routing (SEO-friendly)
 * - Auth guard (redirect if not logged in)
 * - Location data fetch (from locationStore)
 * - WebSocket real-time updates
 * - Permission gating (APPROVED characters only can write)
 *
 * @page pages/locations/[slug]/chat
 * @since 2.0.0
 */

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

import { ChatContainer } from '@/components/chat/ChatContainer';
import { GameLayout } from '@/components/layout/GameLayout';
import { useAuthStore } from '@/store/authStore';
import { useGameStateStore } from '@/store/gameStateStore';
import { useLocationStore } from '@/store/locationStore';
import type { AccessibleLocation } from '@/types/location';
import styles from '@/styles/pages/locations.module.scss';
import { logger } from '@/lib/logger';

/**
 * Location Chat Page Component
 *
 * Dynamic page for location chat.
 *
 * **URL Pattern**: `/locations/{slug}/chat`
 *
 * @returns {JSX.Element} Chat page
 */
export default function LocationChatPage(): JSX.Element {
  const router = useRouter();
  const { slug } = router.query;

  // Debug: Log URL changes
  useEffect(() => {
    logger.info('[Chat] 📍 URL changed - slug:', { args: [slug, '| pathname:', router.pathname, '| asPath:', router.asPath] });
  }, [slug, router.pathname, router.asPath]);

  // Auth store: Check if user logged in
  const { isAuthenticated, selectedCharacter } = useAuthStore();

  // Location store: Get locations (use separate selectors to avoid infinite loop)
  const locations = useLocationStore((state) => state.locations);
  const isLocationStoreLoading = useLocationStore((state) => state.isLoading);

  // Local state: Current location
  const [location, setLocation] = useState<AccessibleLocation | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  /**
   * Auth Guard: Redirect to login if not authenticated
   */
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  /**
   * Character Guard: Redirect to character selection if no character selected
   */
  useEffect(() => {
    if (isAuthenticated && !selectedCharacter) {
      router.push('/characters');
    }
  }, [isAuthenticated, selectedCharacter, router]);

  /**
   * Initialize location store if empty
   * This handles the case where the page loads before GameLayout initializes the store
   */
  useEffect(() => {
    if (selectedCharacter && locations.length === 0 && !isLocationStoreLoading) {
      logger.info('[LocationChat] Initializing locationStore...');
      useLocationStore.getState().initialize(selectedCharacter._id);
    }
  }, [selectedCharacter?._id, locations.length, isLocationStoreLoading]);

  /**
   * Find location by slug
   */
  useEffect(() => {
    if (!slug || typeof slug !== 'string') {
      logger.info('[Chat] ⏭️  Skipping location lookup - no slug yet');
      return;
    }

    logger.info('[Chat] 🔍 Looking for location with slug:', { args: [slug, '| Available locations:', locations.length] });

    // Find location in store
    const foundLocation = locations.find((loc) => loc.slug === slug);

    if (foundLocation) {
      setLocation(foundLocation);
      setIsLoadingLocation(false);
      logger.info(`[Chat] ✅ Location found: ${foundLocation.name} (${slug}) - ID: ${foundLocation._id}`);
    } else {
      // Location not found → 404
      setLocation(null);
      setIsLoadingLocation(false);
      logger.warn(`[Chat] ⚠️  Location NOT found: ${slug} - Available locations:`, { value: locations.map(l => l.slug) });
    }
  }, [slug, locations]);

  /**
   * Effect: Enter/leave location (CENTRALIZED via GameStateStore)
   *
   * Single effect that handles:
   * 1. Enter location → gameStateStore.enterLocation()
   * 2. Leave location on unmount → gameStateStore.leaveLocation()
   *
   * GameStateStore centralizes:
   * - Local state update (optimistic)
   * - Backend persistence (HTTP)
   * - WebSocket room join/leave
   */
  useEffect(() => {
    if (!location?._id || !location?.name) {
      return;
    }

    logger.info('[Chat] 📍 Location detected:', { args: [location.name, '- entering via GameStateStore'] });

    // Enter location (centralized)
    const { enterLocation, leaveLocation } = useGameStateStore.getState();

    enterLocation(location._id, location.name).catch((error) => {
      logger.error('[Chat] ❌ Failed to enter location:', { error });
      // NOTE: User still sees chat even if enter fails (graceful degradation)
    });

    // Cleanup: Leave on unmount
    return () => {
      logger.info('[Chat] 🚪 Component unmounting - leaving location');
      leaveLocation().catch((error) => {
        logger.error('[Chat] ❌ Failed to leave location:', { error });
      });
    };
  }, [location?._id, location?.name]);

  // Loading state (waiting for auth, location store, or specific location data)
  if (!isAuthenticated || !selectedCharacter || isLoadingLocation || isLocationStoreLoading) {
    return (
      <>
        <Head>
          <title>Ten Penny Novels | Chat Location</title>
          <meta name="description" content="Chatta in tempo reale nella Londra Vittoriana. Gioco di ruolo online con narrazione investigativa." />
        </Head>
        <GameLayout>
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p className={styles.loadingText}>Caricamento...</p>
          </div>
        </GameLayout>
      </>
    );
  }

  // 404: Location not found
  if (!location) {
    return (
      <>
        <Head>
          <title>Ten Penny Novels | Location Non Trovata</title>
          <meta name="description" content="La location che cerchi non esiste o non è accessibile." />
        </Head>
        <GameLayout>
          <div className={styles.errorContainer}>
            <h2 className={styles.errorTitle}>Location non trovata</h2>
            <p className={styles.errorMessage}>
              La location richiesta non esiste o non hai accesso ad essa.
            </p>
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => router.push('/locations')}
            >
              Torna alle Location
            </button>
          </div>
        </GameLayout>
      </>
    );
  }

  // Chat page
  return (
    <>
      <Head>
        <title>Ten Penny Novels | {location.name} - Chat</title>
        <meta name="description" content={`Chatta in tempo reale a ${location.name} nella Londra Vittoriana del 1890. Gioco di ruolo investigativo con sistema Call of Cthulhu.`} />
      </Head>
      <GameLayout>
        <ChatContainer locationSlug={location.slug} locationId={location._id} locationName={location.name} />
      </GameLayout>
    </>
  );
}
