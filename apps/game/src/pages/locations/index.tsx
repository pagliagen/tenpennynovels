import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { LocationsView } from '@/components/LocationsView';
import { GameInitResponse } from '@/lib/gameApi';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useLocationsCache } from '@/hooks/useLocationsCache';
import { useAdminCacheHooks } from '@/hooks/useAdminCacheHooks';

interface LocationsPageProps {
  gameData: GameInitResponse;
}

export default function LocationsPage({ gameData }: LocationsPageProps) {
  const { onPresenceUpdate } = useWebSocket();
  
  // Use cache-aware locations hook instead of direct state
  const { locations, updateLocation, cacheInfo } = useLocationsCache(gameData.locations);
  
  // Listen for admin cache invalidation events
  useAdminCacheHooks();

  // No longer needed - presence is handled entirely through globalPresence updates

  // Debug cache info
  useEffect(() => {
    // console.log('🗄️ LocationsPage: Cache info:', cacheInfo);
    // console.log('🗄️ LocationsPage: Loaded locations:', locations.length);
  }, [cacheInfo, locations]);

  return (
    <LocationsView
      locations={locations}
      onLocationClick={() => {}} // Not needed anymore - WebSocket handles navigation
    />
  );
} 