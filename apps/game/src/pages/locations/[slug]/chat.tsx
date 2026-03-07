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

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { GameLayout } from '@/components/layout/GameLayout';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { useAuthStore } from '@/store/authStore';
import { useLocationStore } from '@/store/locationStore';
import { useGameStateStore } from '@/store/gameStateStore';
import type { AccessibleLocation } from '@/types/location';

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
    console.log('[Chat] 📍 URL changed - slug:', slug, '| pathname:', router.pathname, '| asPath:', router.asPath);
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
      router.push('/auth/login');
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
      console.log('[LocationChat] Initializing locationStore...');
      useLocationStore.getState().initialize(selectedCharacter._id);
    }
  }, [selectedCharacter?._id, locations.length, isLocationStoreLoading]);

  /**
   * Find location by slug
   */
  useEffect(() => {
    if (!slug || typeof slug !== 'string') {
      console.log('[Chat] ⏭️  Skipping location lookup - no slug yet');
      return;
    }

    console.log('[Chat] 🔍 Looking for location with slug:', slug, '| Available locations:', locations.length);

    // Find location in store
    const foundLocation = locations.find((loc) => loc.slug === slug);

    if (foundLocation) {
      setLocation(foundLocation);
      setIsLoadingLocation(false);
      console.log(`[Chat] ✅ Location found: ${foundLocation.name} (${slug}) - ID: ${foundLocation._id}`);
    } else {
      // Location not found → 404
      setLocation(null);
      setIsLoadingLocation(false);
      console.warn(`[Chat] ⚠️  Location NOT found: ${slug} - Available locations:`, locations.map(l => l.slug));
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

    console.log('[Chat] 📍 Location detected:', location.name, '- entering via GameStateStore');

    // Enter location (centralized)
    const { enterLocation, leaveLocation } = useGameStateStore.getState();

    enterLocation(location._id, location.name).catch((error) => {
      console.error('[Chat] ❌ Failed to enter location:', error);
      // NOTE: User still sees chat even if enter fails (graceful degradation)
    });

    // Cleanup: Leave on unmount
    return () => {
      console.log('[Chat] 🚪 Component unmounting - leaving location');
      leaveLocation().catch((error) => {
        console.error('[Chat] ❌ Failed to leave location:', error);
      });
    };
  }, [location?._id, location?.name]);

  // Loading state (waiting for auth, location store, or specific location data)
  if (!isAuthenticated || !selectedCharacter || isLoadingLocation || isLocationStoreLoading) {
    return (
      <>
        <Head>
          <title>Chat Location - Ten Penny Novels</title>
          <meta name="description" content="Chatta in tempo reale nella Londra Vittoriana. Gioco di ruolo online con narrazione investigativa." />
        </Head>
        <GameLayout>
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#e8d4a0',
              fontFamily: '"Playfair Display", serif',
              fontSize: '1.2rem',
            }}
          >
            Caricamento...
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
          <title>Location Non Trovata - Ten Penny Novels</title>
          <meta name="description" content="La location che cerchi non esiste o non è accessibile." />
        </Head>
        <GameLayout>
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              color: '#e8d4a0',
              fontFamily: '"Playfair Display", serif',
              fontSize: '1.2rem',
            }}
          >
            <p>⚠️ Location non trovata</p>
            <button
              onClick={() => router.push('/locations')}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(184, 134, 11, 0.7)',
                border: '1px solid rgba(184, 134, 11, 1)',
                borderRadius: '6px',
                color: '#fff',
                fontFamily: '"Playfair Display", serif',
                fontSize: '1rem',
                cursor: 'pointer',
              }}
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
        <title>{location.name} - Chat - Ten Penny Novels</title>
        <meta name="description" content={`Chatta in tempo reale a ${location.name} nella Londra Vittoriana del 1890. Gioco di ruolo investigativo con sistema Call of Cthulhu.`} />
      </Head>
      <GameLayout>
        <ChatContainer locationSlug={location.slug} locationId={location._id} locationName={location.name} />
      </GameLayout>
    </>
  );
}
