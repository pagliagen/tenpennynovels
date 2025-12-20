import React, { useState } from 'react';
import styles from '../styles/components/LondonMap.module.scss';

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

interface LondonMapProps {
  locations: Location[];
  onDistrictClick: (location: Location) => void;
  currentView: 'mappa' | 'district';
  onLondonClick?: () => void;
  selectedDistrictId?: string;
  onLocationClick?: (location: Location) => void;
  showLabel?: boolean;
  showLegend?: boolean;
  showPeriferia?: boolean;
}

// Coordinate delle aree cliccabili basate sulla mappa london.png reale (percentuali)
const DISTRICT_COORDINATES = {
  'Westminster': {
    polygon: '25,35 45,32 48,45 45,48 40,50 25,48',
    center: { x: 36, y: 42 }
  },
  'Oldtown': {
    polygon: '48,32 68,30 72,42 68,46 62,48 48,45',
    center: { x: 58, y: 39 }
  },
  'Mayfair-Marylebone': {
    polygon: '8,25 25,23 25,35 25,48 18,50 8,45',
    center: { x: 17, y: 37 }
  },
  'East-End': {
    polygon: '72,30 92,28 95,40 90,45 85,47 72,42',
    center: { x: 82, y: 38 }
  },
  'Southwark': {
    polygon: '20,52 80,50 85,62 78,68 70,70 20,68 15,60',
    center: { x: 50, y: 60 }
  }
};

export const LondonMap: React.FC<LondonMapProps> = ({
  locations,
  onDistrictClick,
  currentView,
  onLondonClick,
  selectedDistrictId,
  onLocationClick,
  showLabel = true,
  showLegend = true,
  showPeriferia = true
}) => {
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [hoveredPeriferia, setHoveredPeriferia] = useState(false);

  const getLocationByName = (districtName: string) => {
    return locations.find(loc => loc.name === districtName);
  };

  const getLocationById = (id: string) => {
    return locations.find(loc => loc.id === id);
  };

  const handleDistrictHover = (districtName: string, event: React.MouseEvent) => {
    if (currentView === 'mappa') { // Only show tooltip in normal map view
      const location = getLocationByName(districtName);
      if (location && location.accessible) {
        setHoveredDistrict(districtName);
        setShowTooltip(true);
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      }
    }
  };

  const handleDistrictLeave = () => {
    setHoveredDistrict(null);
    setShowTooltip(false);
  };

  const handleDistrictClick = (districtName: string) => {
    if (currentView === 'mappa') { // Only allow clicks in normal map view
      const location = getLocationByName(districtName);
      if (location && location.accessible) {
        onDistrictClick(location);
      }
    }
  };

  const handlePeriferiaClick = () => {
    if (currentView === 'mappa') { // Only allow clicks in normal map view
      const boroughsLocation = getLocationByName('Boroughs');
      if (boroughsLocation && boroughsLocation.accessible) {
        onDistrictClick(boroughsLocation);
      }
    }
  };


  return (
    <div className={styles.mapContainer}>
      <div className={styles.mapWrapper}>
        <div className={styles.mapBackground}>
          {/* London Label - Only show when showLabel is true */}
          {showLabel && (
            <div 
              className={styles.londonLabel}
              onClick={onLondonClick}
              style={{ cursor: onLondonClick ? 'pointer' : 'default' }}
            >
              <img 
                src="/locations/london_label.png" 
                alt="The City of London - Clicca per tornare a Londra"
                className={styles.labelImage}
              />
            </div>
          )}
          
          <img 
            src="/locations/london.png" 
            alt="Mappa di Londra 1889"
            className={styles.mapImage}
          />
          
          <svg 
            className={styles.mapOverlay}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Definizione degli effetti di luce molto sottili */}
            <defs>
              <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="0.8" result="softBlur"/>
                <feColorMatrix 
                  in="softBlur"
                  type="matrix" 
                  values="1 0 0 0 0.85  0 1 0 0 0.7  0 0 1 0 0.25  0 0 0 0.4 0"
                  result="subtleGold"/>
                <feMerge>
                  <feMergeNode in="subtleGold"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              
              <filter id="whisperLight" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="0.5" result="whisperBlur"/>
                <feColorMatrix 
                  in="whisperBlur"
                  type="matrix" 
                  values="1 0 0 0 0.9  0 1 0 0 0.8  0 0 1 0 0.4  0 0 0 0.25 0"
                  result="whisperGold"/>
                <feMerge>
                  <feMergeNode in="whisperGold"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {Object.entries(DISTRICT_COORDINATES).map(([districtName, coords]) => {
              const location = getLocationByName(districtName);
              const isAccessible = location?.accessible ?? false;
              const isHovered = hoveredDistrict === districtName;
              const isSelected = location?.id === selectedDistrictId;
              
              return (
                <g key={districtName}>
                  {/* Area cliccabile - only interactive in normal map view */}
                  <polygon
                    points={coords.polygon}
                    fill={isSelected ? "rgba(212, 175, 55, 0.3)" : "transparent"}
                    stroke={isSelected ? "#d4af37" : "transparent"}
                    strokeWidth={isSelected ? "2" : "0"}
                    onMouseEnter={(e) => handleDistrictHover(districtName, e)}
                    onMouseLeave={handleDistrictLeave}
                    onMouseMove={(e) => setTooltipPosition({ x: e.clientX, y: e.clientY })}
                    onClick={() => handleDistrictClick(districtName)}
                    style={{
                      cursor: currentView === 'mappa' && isAccessible ? 'pointer' : 'default'
                    }}
                  />
                  
                  {/* Effetto bordo luminoso sottilissimo quando hover - only in normal map view */}
                  {isHovered && isAccessible && currentView === 'mappa' && (
                    <g>
                      <polygon
                        points={coords.polygon}
                        fill="none"
                        stroke="#d4af37"
                        strokeWidth="0.6"
                        opacity="0.2"
                        filter="url(#subtleGlow)"
                        className={styles.glowBorder}
                      />
                      
                      <polygon
                        points={coords.polygon}
                        fill="none"
                        stroke="#f4e4a6"
                        strokeWidth="0.4"
                        strokeDasharray="4 6"
                        opacity="0.15"
                        filter="url(#whisperLight)"
                        className={styles.rotatingLight}
                      />
                    </g>
                  )}
                  
                  {/* Area non accessibile - bordo rosso fisso */}
                  {isHovered && !isAccessible && currentView === 'mappa' && (
                    <polygon
                      points={coords.polygon}
                      fill="none"
                      stroke="#ff6b6b"
                      strokeWidth="2"
                      opacity="0.6"
                      strokeDasharray="4 2"
                    />
                  )}
                
                  {/* Indicatore occupanti se presenti */}
                  {location && (location.occupants || 0) > 0 && (
                    <circle
                      cx={coords.center.x}
                      cy={coords.center.y}
                      r="2"
                      fill="#ff6b35"
                      stroke="#ffffff"
                      strokeWidth="0.5"
                      opacity="0.9"
                      className={styles.occupantsIndicator}
                    />
                  )}
                </g>
              );
            })}
          </svg>
          
          {/* Periferia Area - Only show when showPeriferia is true */}
          {showPeriferia && (
            <div 
              className={`${styles.periferiaArea} ${(hoveredPeriferia || hoveredDistrict === 'Boroughs') ? styles.periferiaHovered : ''}`}
              onMouseEnter={() => {
                setHoveredPeriferia(true);
                setHoveredDistrict('Boroughs');
              }}
              onMouseLeave={() => {
                setHoveredPeriferia(false);
                setHoveredDistrict(null);
              }}
              onClick={handlePeriferiaClick}
              style={{ 
                cursor: (() => {
                  const boroughsLocation = getLocationByName('Boroughs');
                  return currentView === 'mappa' && boroughsLocation?.accessible ? 'pointer' : 'default';
                })()
              }}
            >
              <img 
                src="/locations/london_boroughs.png" 
                alt="Periferia di Londra"
                className={styles.periferiaImage}
              />
              <div className={styles.periferiaLabel}>Periferia</div>
            </div>
          )}
        </div>
      </div>
      
      {/* Tooltip - Only show in normal map view */}
      {showTooltip && hoveredDistrict && currentView === 'mappa' && (
        <div 
          className={styles.tooltip}
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 10
          }}
        >
          {(() => {
            const location = getLocationByName(hoveredDistrict);
            if (!location) return null;
            
            return (
              <div>
                <div className={styles.tooltipTitle}>{location.name}</div>
                <div className={styles.tooltipDescription}>
                  {location.description}
                </div>
                {(location.occupants || 0) > 0 && (
                  <div className={styles.tooltipOccupants}>
                    👥 {location.occupants} presente/i
                  </div>
                )}
                {location.hasShop && (
                  <div className={styles.tooltipFeature}>🛍️ Ha negozio</div>
                )}
                {location.private && (
                  <div className={styles.tooltipFeature}>🔒 Area privata</div>
                )}
              </div>
            );
          })()}
        </div>
      )}
      
      {/* Legend - Only show when showLegend is true */}
      {showLegend && (
        <div className={styles.legend}>
          <div className={styles.legendTitle}>Quartieri di Londra</div>
          <div className={styles.legendItems}>
            {locations.map((location) => (
              <div 
                key={location.id}
                className={`${styles.legendItem} ${
                  !location.accessible ? styles.legendInaccessible : ''
                } ${hoveredDistrict === location.name ? styles.legendHighlighted : ''}`}
                onMouseEnter={() => setHoveredDistrict(location.name)}
                onMouseLeave={() => setHoveredDistrict(null)}
                onClick={() => location.accessible && onDistrictClick(location)}
                style={{
                  cursor: location.accessible ? 'pointer' : 'not-allowed'
                }}
              >
                <div className={styles.legendDot}></div>
                <span className={styles.legendLabel}>{location.name}</span>
                {(location.occupants || 0) > 0 && (
                  <span className={styles.legendOccupants}>({location.occupants})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};