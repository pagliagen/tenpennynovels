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
import { useWebSocket } from '@/contexts/WebSocketContext';
import { locationsApi } from '@/lib/api/locations';
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

  // WebSocket context for real-time layer
  const { socket } = useWebSocket();

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
   * Effect 1: Sync authStore when location changes
   *
   * Updates selectedCharacter.currentLocation for topbar/sidebar display.
   * Guard prevents unnecessary updates (avoids triggering parent re-renders).
   */
  useEffect(() => {
    if (!location?._id) {
      return;
    }

    const char = useAuthStore.getState().selectedCharacter;
    if (!char) {
      return;
    }

    // Guard: Only update if currentLocation actually changed
    if (char.currentLocation !== location._id) {
      console.log('[Chat] 🔄 Updating authStore - OLD:', char.currentLocation, '→ NEW:', location._id);
      useAuthStore.getState().setSelectedCharacter({
        ...char,
        currentLocation: location._id
      });
      console.log('[Chat] ✅ authStore synced - currentLocation:', location._id);
    } else {
      console.log('[Chat] ⏭️ No update needed - currentLocation already:', location._id);
    }
  }, [location?._id]);

  /**
   * Effect 2: Enter/leave location (HTTP + WebSocket)
   *
   * Dual-layer architecture:
   * - Layer 1 (HTTP): Persistence, updates DB (character.currentLocation, location.occupants)
   * - Layer 2 (WebSocket): Real-time, joins Socket.IO room for broadcasts
   *
   * Cleanup emits leave_location. DB cleanup handled by WebSocket disconnect handler.
   */
  useEffect(() => {
    if (!location?._id || !socket) {
      return;
    }

    const currentCharacter = useAuthStore.getState().selectedCharacter;
    if (!currentCharacter) {
      return;
    }

    // AbortController for canceling in-flight HTTP on unmount
    const controller = new AbortController();

    // Async IIFE for enter flow
    (async () => {
      try {
        // Layer 1: HTTP persistence (DB update)
        await locationsApi.enter(location._id);
        console.log('[Chat] ✅ DB updated - entered location:', location._id);

        // Layer 2: WebSocket real-time (Socket.IO room join)
        socket.emit('join_location', location._id);
        console.log('[Chat] ✅ WebSocket emitted - join_location:', location._id);

      } catch (error: any) {
        // Ignore aborted requests (expected on unmount)
        if (error.name === 'AbortError') {
          return;
        }

        console.error('[Chat] ❌ Failed to enter location:', error);
        // NOTE: User still sees chat even if enter fails (graceful degradation)
      }
    })();

    // Cleanup: Cancel in-flight HTTP + emit leave
    return () => {
      controller.abort();

      if (socket) {
        socket.emit('leave_location', location._id);
        console.log('[Chat] ✅ WebSocket emitted - leave_location:', location._id);
      }
    };
  }, [location?._id, socket]);

  // Loading state (waiting for auth, location store, or specific location data)
  if (!isAuthenticated || !selectedCharacter || isLoadingLocation || isLocationStoreLoading) {
    return (
      <>
        <Head>
          <title>Chat Location - TenpennyNovels</title>
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
          <title>Location Non Trovata - TenpennyNovels</title>
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
        <title>{location.name} - Chat - TenpennyNovels</title>
        <meta name="description" content={`Chatta in tempo reale a ${location.name} nella Londra Vittoriana del 1890. Gioco di ruolo investigativo con sistema Call of Cthulhu.`} />
      </Head>
      <GameLayout>
        <ChatContainer locationSlug={location.slug} locationId={location._id} locationName={location.name} />
      </GameLayout>
    </>
  );
}
