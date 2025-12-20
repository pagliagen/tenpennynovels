import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { GameApiService, LocationResponse, GameInitResponse } from '@/lib/gameApi';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useGame } from '@/contexts/GameContext';
import { CacheManager, CACHE_KEYS } from '@/utils/cache';
import LocationChat from '@/components/location/LocationChat';
import styles from '@/styles/pages/Game.module.scss';

interface LocationChatPageProps {
  gameData: GameInitResponse;
}

// Internal component that handles location chat
function LocationChatContent({ locationId, gameData }: { locationId: string; gameData: GameInitResponse }) {
  const [locationData, setLocationData] = useState<LocationResponse | null>(null);
  const [isValidLocation, setIsValidLocation] = useState<boolean | null>(null); // null = checking, true = valid, false = invalid
  const { joinLocation } = useWebSocket();
  const { updateCharacter } = useGame();
  const router = useRouter();

  // Validate location and set current location
  useEffect(() => {
    if (!router.isReady || !locationId) {
      return;
    }

    // console.log('🔍 LocationPage: Validating location ID:', locationId);

    // 1. VALIDATE: Check if location exists in localStorage cache
    const cachedLocations = CacheManager.get(CACHE_KEYS.LOCATIONS) as any[] | null;
    const locationExists = Array.isArray(cachedLocations) && cachedLocations.some((loc: any) => loc.id === locationId);

    if (!locationExists) {
      console.error('❌ LocationPage: Location not found in cache:', locationId);
      setIsValidLocation(false);
      return;
    }

    // console.log('✅ LocationPage: Location validated, proceeding...');
    setIsValidLocation(true);

    // console.log('🎯 LocationPage: IMMEDIATELY updating current location to:', locationId);

    // 2. IMMEDIATE: Update character location (lista presenti si aggiorna subito)
    updateCharacter({ currentLocationId: locationId });

    // 3. ASYNC: Update backend + WebSocket for other players
    const updateLocation = async () => {
      try {
        // console.log('📡 LocationPage: Calling set-location API for others...');
        const result = await GameApiService.setCharacterLocation(locationId);
        if (result.success) {
          // console.log('✅ LocationPage: Backend location updated, WebSocket will notify others');
        } else {
          console.error('❌ LocationPage: Failed to update backend location:', result.error);
        }
      } catch (error) {
        console.error('❌ LocationPage: Error updating backend location:', error);
      }
    };

    updateLocation();

    // 4. Join WebSocket room
    // console.log('🔌 LocationPage: Joining WebSocket location room:', locationId);
    joinLocation(locationId);

    // 5. Load chat history
    const loadLocationData = async () => {
      try {
        const locationResult = await GameApiService.getLocation(locationId);
        if (locationResult.success) {
          setLocationData(locationResult);
        }
      } catch (error) {
        console.error('❌ LocationPage: Error loading location data:', error);
      }
    };

    loadLocationData();
  }, [router.isReady, locationId, joinLocation, updateCharacter]);

  const handleMappeClick = () => {
    router.push('/locations');
  };

  const getCurrentLocation = () => {
    if (locationData?.location) {
      return locationData.location;
    }
    if (!gameData?.locations || !locationId) return null;
    return gameData.locations.find(loc => loc.id === locationId);
  };

  const currentLocation = getCurrentLocation();

  // Show error page if location is invalid
  if (isValidLocation === false) {
    return (
      <>
        <Head>
          <title>TenpennyNovels Londra vittoriana - Location Non Trovata</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon/favicon.ico" />
        </Head>

        <div className={styles.gameContent}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '60vh',
            textAlign: 'center',
            gap: '2rem'
          }}>
            <div style={{ fontSize: '4rem' }}>🚫</div>
            <h1 style={{ fontSize: '2rem', margin: 0 }}>La pagina non esiste</h1>
            <p style={{ fontSize: '1.2rem', color: '#666', maxWidth: '400px' }}>
              La location richiesta non è stata trovata o non hai i permessi per accedervi.
            </p>
            <button
              onClick={handleMappeClick}
              style={{
                padding: '1rem 2rem',
                fontSize: '1.1rem',
                backgroundColor: '#8B4513',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🗺️ Torna a Mappa
            </button>
          </div>
        </div>
      </>
    );
  }

  // Show loading while validating
  if (isValidLocation === null) {
    return (
      <>
        <Head>
          <title>TenpennyNovels Londra vittoriana - Caricamento Location</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon/favicon.ico" />
        </Head>

        <div className={styles.gameContent}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '60vh',
            textAlign: 'center',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '2rem' }}>⏳</div>
            <h1>Verificando Location...</h1>
          </div>
        </div>
      </>
    );
  }

  // Render normal location chat when valid
  return (
    <div className={styles.gameContent}>
      {gameData.character && (
        <LocationChat
          locationId={locationId}
          characterId={gameData.character.id}
          characterName={gameData.character.name}
          characterRoles={gameData.character.gameplayRoles || []}
          chatHistory={(locationData?.chatHistory || []) as any}
          characterStatus={gameData.character.status || 'UNKNOWN'}
          characterData={{
            ...gameData.character,
            stats: {},
            skills: {},
            equippedItems: []
          }}
          skillTemplates={(gameData.draftConfiguration?.baseSkills || []).map(skill => ({
            name: skill.name,
            baseValue: skill.baseValue,
            category: skill.category,
            canRollWithoutPoints: false,
            isPlaceholder: false
          }))}
        />
      )}
    </div>
  );
}

export default function LocationChatPage({ gameData }: LocationChatPageProps) {
  const router = useRouter();
  const { locationId } = router.query;

  if (!router.isReady || !locationId) {
    return (
      <>
        <Head>
          <title>TenpennyNovels Londra vittoriana - Caricamento Location</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon/favicon.ico" />
        </Head>

        <div className={styles.loadingScreen}>
          <div className={styles.loadingContent}>
            <h1 className={styles.loadingTitle}>TenpennyNovels</h1>
            <p className={styles.loadingText}>Loading location...</p>
            <div className={styles.loadingSpinner}></div>
          </div>
        </div>
      </>
    );
  }

  return <LocationChatContent locationId={locationId as string} gameData={gameData} />;
} 