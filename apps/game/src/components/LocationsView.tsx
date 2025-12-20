import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/components/LocationsView.module.scss';
import { LondonMap } from './LondonMap'; 
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useGame } from '@/contexts/GameContext';
import { CacheManager, CACHE_KEYS, getLondonLocationId } from '@/utils/cache';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface Location {
  id: string;
  name: string;
  description?: string;
  accessible: boolean;
  occupants?: number;
  occupantsList?: Array<{
    characterId: string;
    characterName: string;
    enteredAt: string;
    lastSeen: string;
  }>;
  hasShop?: boolean;
  hasChat?: boolean;
  private?: boolean;
  district?: string;
  parentLocation?: string;
  locationLevel?: 'root' | 'district' | 'location';
  sortOrder?: number;
  children?: Location[];
  imageUrl?: string;
  settings?: {
    visible: boolean;
    chat: boolean;
    shop: boolean;
    private?: boolean;
  };
}

interface LocationsViewProps {
  locations: Location[];
  onLocationClick: (location: Location) => void;
}

type ViewType = 'mappa' | 'testuale' | 'appartamenti';

export const LocationsView: React.FC<LocationsViewProps> = ({
  locations,
  onLocationClick
}) => {
  const { isConnected, connectionError } = useWebSocket();
  const router = useRouter();
  const [currentView, setCurrentView] = useState<ViewType>('mappa');
  const [selectedDistrict, setSelectedDistrict] = useState<Location | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [isEnteringChat, setIsEnteringChat] = useState(false);
  
  const districts = locations.filter(loc => loc.locationLevel === 'district');
  
  useEffect(() => {
    const handleLocationEntered = () => {
      setIsEnteringChat(false);
    };
    
    window.addEventListener('location-entered', handleLocationEntered);
    return () => window.removeEventListener('location-entered', handleLocationEntered);
  }, []);
  
  const handleDistrictClick = (district: Location) => {
    setSelectedDistrict(district);
  };

  const handleBackToMap = () => {
    setSelectedDistrict(null);
    setSelectedLocation(null);
  };

  const handleLocationSelect = (location: Location) => {
    setSelectedLocation(location);
  };

  const handleEnterChat = async () => {
    if (selectedLocation && !isEnteringChat) {
      setIsEnteringChat(true);
      
      try {
        // Verify location is cached (accessible)
        const cachedLocations = CacheManager.get(CACHE_KEYS.LOCATIONS) as Location[] | null;
        const isLocationCached = Array.isArray(cachedLocations) && cachedLocations.some((loc: Location) => loc.id === selectedLocation.id);
        
        if (!isLocationCached) {
          console.error('❌ LocationsView: Location not in cache, cannot access');
          setIsEnteringChat(false);
          return;
        }
        
        // IMMEDIATE: Update character location (lista presenti si aggiorna subito come per London)
        updateCharacter({ currentLocationId: selectedLocation.id });
        
        // Navigate using Next.js router (not window.location.href)
        await router.push(`/locations/${selectedLocation.id}`);
        
        setIsEnteringChat(false);
        
      } catch (error) {
        console.error('❌ LocationsView: Error navigating to location:', error);
        setIsEnteringChat(false);
      }
    }
  };

  const { updateCharacter } = useGame();

  const handleLondonClick = async () => {
    try {
      // 1. IMMEDIATE: Update character location (lista presenti + header si aggiornano subito)
      updateCharacter({ currentLocationId: null }); // null = London/root
      
      // 2. ASYNC: Update backend + WebSocket for other players
      const response = await fetch(`${API_BASE_URL}/game/characters/set-location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          locationId: '' // Empty string tells backend to set currentLocation = null
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ LocationsView: Failed to set location to London:', error);
    }
  };

  // Ottieni tutte le sotto-location del distretto, inclusi i sotto-livelli
  const getDistrictLocations = (parentId: string): Location[] => {
    const directChildren = locations.filter(loc => loc.parentLocation === parentId);
    let allLocations: Location[] = [...directChildren];
    
    // Aggiungi ricorsivamente i figli dei figli
    directChildren.forEach(child => {
      allLocations = [...allLocations, ...getDistrictLocations(child.id)];
    });
    
    return allLocations.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  };

  // Crea struttura ad albero per la navigazione
  const buildLocationTree = (parentId: string): Location[] => {
    return locations
      .filter(loc => loc.parentLocation === parentId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map(location => ({
        ...location,
        children: buildLocationTree(location.id)
      }));
  };

  const renderLocationTree = (locations: Location[], level = 0): React.ReactNode => {
    return locations.map(location => (
      <div key={location.id} className={styles.treeItem} style={{ marginLeft: `${level * 20}px` }}>
        <div
          className={`${styles.treeNode} ${
            selectedLocation?.id === location.id ? styles.selected : ''
          } ${
            !location.accessible ? styles.inaccessible : ''
          }`}
          onClick={() => location.accessible && handleLocationSelect(location)}
        >
          <div className={styles.treeNodeContent}>
            <span className={styles.locationIcon}>
              {location.children && location.children.length > 0 ? '📁' : '📍'}
            </span>
            <span className={styles.locationName}>{location.name}</span>
            {(location.occupants || 0) > 0 && (
              <span className={styles.occupantsCount}>({location.occupants})</span>
            )}
            <div className={styles.locationBadges}>
              {(location.private || location.settings?.private) && (
                <span className={styles.badge} title="Privata">🔒</span>
              )}
              {(location.hasShop || location.settings?.shop) && (
                <span className={styles.badge} title="Negozio">🛍️</span>
              )}
              {location.settings?.chat && (
                <span className={styles.badge} title="Chat attiva">💬</span>
              )}
            </div>
          </div>
        </div>
        {location.children && location.children.length > 0 && (
          <div className={styles.treeChildren}>
            {renderLocationTree(location.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const renderLocationViewDetail = () => {
    // Se è stato selezionato un distretto, mostra la mappa con overlay 
    if (selectedDistrict) {
      const districtLocations = getDistrictLocations(selectedDistrict.id);
      const locationTree = buildLocationTree(selectedDistrict.id);

      return (
        <div className={styles.locationViewDetail}>
          <div className={styles.districtDetailsContent}>
            <div className={styles.districtDetailsHeader}>
              <h2 className={styles.districtDetailsTitle}>{selectedDistrict.name}</h2>
              <button 
                className={styles.backButton}
                onClick={handleBackToMap}
              >
                ← Torna alla Mappa
              </button>
            </div>
            
            <div className={styles.districtContent}>
              {/* Navigation Panel with Location Tree */}
              <div className={styles.navigationPanel}>
                <div className={styles.panelHeader}>
                  <h3>Locations</h3>
                  <span className={styles.locationCount}>
                    {districtLocations.length} location{districtLocations.length !== 1 ? 'i' : ''}
                  </span>
                </div>
                
                <div className={styles.treeContainer}>
                  {locationTree.length > 0 ? (
                    renderLocationTree(locationTree)
                  ) : (
                    <div className={styles.emptyTree}>Nessuna location disponibile</div>
                  )}
                </div>
              </div>
              
              {/* Details Panel - Shows map or location details */}
              <div className={styles.detailsPanel}>
                {selectedLocation ? (
                  /* Location Details View */
                  <div className={styles.locationDetails}>
                    {selectedLocation.imageUrl && (
                      <div className={styles.locationImageContainer}>
                        <img 
                          src={selectedLocation.imageUrl}
                          alt={selectedLocation.name}
                          className={styles.locationImage}
                        />
                      </div>
                    )}
                    
                    <div className={styles.locationInfo}>
                      <h2 className={styles.locationTitle}>{selectedLocation.name}</h2>
                      <p className={styles.locationDescription}>{selectedLocation.description || 'Nessuna descrizione disponibile'}</p>
                      
                      <div className={styles.locationStats}>
                        {(selectedLocation.occupants || 0) > 0 && (
                          <div className={styles.stat}>
                            <span className={styles.statIcon}>👥</span>
                            <span>{selectedLocation.occupants} presente{selectedLocation.occupants !== 1 ? 'i' : ''}</span>
                          </div>
                        )}
                        {selectedLocation.hasShop && (
                          <div className={styles.stat}>
                            <span className={styles.statIcon}>🛍️</span>
                            <span>Ha negozio</span>
                          </div>
                        )}
                        {selectedLocation.private && (
                          <div className={styles.stat}>
                            <span className={styles.statIcon}>🔒</span>
                            <span>Area privata</span>
                          </div>
                        )}
                      </div>
                      
                      <div className={styles.actionButtons}>
                        {selectedLocation.accessible ? (
                          <>
                            <button 
                              className={`${styles.actionButton} ${styles.chatButton}`}
                              onClick={handleEnterChat}
                              disabled={isEnteringChat}
                            >
                              {isEnteringChat ? (
                                <>
                                  <span className={styles.spinner}>⏳</span> Entrando...
                                </>
                              ) : (
                                '🚪 Entra in Chat'
                              )}
                            </button>
                            {selectedLocation.hasShop && (
                              <button 
                                className={`${styles.actionButton} ${styles.shopButton}`}
                                onClick={() => {/* TODO: Handle shop */}}
                              >
                                🛍️ Visita Negozio
                              </button>
                            )}
                          </>
                        ) : (
                          <div className={styles.inaccessibleNotice}>
                            🚫 Location non accessibile
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* No Location Selected - Show Map Background */
                  <div className={styles.noSelection}>
                    <div className={styles.noSelectionContent}>
                      <span className={styles.noSelectionIcon}>🗺️</span>
                      <h3>Seleziona una Location</h3>
                      <p>Clicca su una location nella lista a sinistra per vedere i dettagli</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Switch per le diverse viste
    switch (currentView) {
      case 'mappa':
        return (
          <div className={styles.locationViewDetail}>
            <LondonMap 
              locations={districts}
              onDistrictClick={handleDistrictClick}
              currentView="mappa"
              onLondonClick={handleLondonClick}
              showLabel={true}
              showLegend={true}
              showPeriferia={true}
            />
          </div>
        );

      case 'testuale':
        return (
          <div className={styles.locationViewDetail}>
            <div className={styles.textualMapView}>
              <div className={styles.districtTreeContainer}>
                <div className={styles.treeHeader}>
                  <h2 className={styles.treeTitle}>Quartieri di Londra</h2>
                  <p className={styles.treeSubtitle}>Seleziona un quartiere per esplorare le sue location</p>
                </div>
                <div className={styles.districtGrid}>
                  {districts.map((district) => (
                    <div 
                      key={district.id}
                      className={`${styles.districtCard} ${!district.accessible ? styles.districtInaccessible : ''}`}
                      onClick={() => district.accessible && handleDistrictClick(district)}
                      style={{ cursor: district.accessible ? 'pointer' : 'not-allowed' }}
                    >
                      <div className={styles.districtCardHeader}>
                        <h3 className={styles.districtName}>{district.name}</h3>
                        {(district.occupants || 0) > 0 && (
                          <span className={styles.districtOccupants}>
                            👥 {district.occupants}
                          </span>
                        )}
                      </div>
                      <p className={styles.districtDescription}>{district.description || 'Nessuna descrizione disponibile'}</p>
                      <div className={styles.districtFeatures}>
                        {district.hasShop && (
                          <span className={styles.featureBadge}>🛍️ Negozio</span>
                        )}
                        {district.private && (
                          <span className={styles.featureBadge}>🔒 Privato</span>
                        )}
                        {!district.accessible && (
                          <span className={`${styles.featureBadge} ${styles.inaccessibleBadge}`}>🚫 Inaccessibile</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'appartamenti':
        return (
          <div className={styles.locationViewDetail}>
            <div className={styles.apartmentsView}>
              <div className={styles.placeholderContent}>
                <h3>Appartamenti</h3>
                <p>Qui saranno mostrati gli appartamenti accessibili al personaggio</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      {/* Navigation Tabs - Always visible at top */}
      <div className={styles.navigationTabs}>
        <button 
          className={`${styles.navTab} ${currentView === 'mappa' ? styles.active : ''}`}
          onClick={() => setCurrentView('mappa')}
        >
          Mappa
        </button>
        <button 
          className={`${styles.navTab} ${currentView === 'testuale' ? styles.active : ''}`}
          onClick={() => setCurrentView('testuale')}
        >
          Mappa testuale
        </button>
        <button 
          className={`${styles.navTab} ${currentView === 'appartamenti' ? styles.active : ''}`}
          onClick={() => setCurrentView('appartamenti')}
        >
          Appartamenti
        </button>
      </div>

      {/* LocationViewDetail - Content area that changes based on currentView and selectedDistrict */}
      {renderLocationViewDetail()}
    </div>
  );
};