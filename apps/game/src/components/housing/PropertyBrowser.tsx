import React, { useState, useEffect } from 'react';
import styles from './HousingDashboard.module.scss';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8000';

interface PropertyFeatures {
  furnished: boolean;
  hasKitchen: boolean;
  hasPrivateBathroom: boolean;
  hasGarden: boolean;
  hasBalcony: boolean;
  fireplace: boolean;
  gaslighting: boolean;
  waterSupply: 'none' | 'shared' | 'private';
  roomCount: number;
}

interface AvailableProperty {
  _id: string;
  locationId: {
    _id: string;
    name: string;
    description?: string;
  };
  propertyType: 'basic_room' | 'furnished_room' | 'luxury_suite' | 'small_house' | 'large_house' | 'mansion';
  district: string;
  address?: string;
  monthlyRent?: number;
  purchasePrice?: number;
  monthlyMaintenance: number;
  deposit?: number;
  features: PropertyFeatures;
  condition: 'poor' | 'fair' | 'good' | 'excellent';
  isAvailable: boolean;
}

interface District {
  name: string;
  description: string;
  averageRent: number;
  propertyCount: number;
  safetyRating: 'very_dangerous' | 'dangerous' | 'unsafe' | 'safe' | 'very_safe';
}

interface PropertyBrowserProps {
  onClose: () => void;
  onPropertyRented: () => void;
}

const PropertyBrowser: React.FC<PropertyBrowserProps> = ({ onClose, onPropertyRented }) => {
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [availableProperties, setAvailableProperties] = useState<AvailableProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<AvailableProperty | null>(null);
  const [showRentModal, setShowRentModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  // Fetch available districts
  const fetchDistricts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/game/housing/districts`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          setDistricts(data.data || []);
        } else {
          setError('Impossibile caricare i distretti');
        }
      } else {
        setError('Errore nel recupero dei distretti');
      }
    } catch (error) {
      console.error('Error fetching districts:', error);
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  // Fetch available properties for a district
  const fetchPropertiesInDistrict = async (district: string) => {
    try {
      setLoadingProperties(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/game/housing/available/${encodeURIComponent(district)}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          setAvailableProperties(data.data?.properties || []);
        } else {
          setError('Impossibile caricare le proprietà');
        }
      } else if (response.status === 404) {
        setAvailableProperties([]);
      } else {
        setError('Errore nel recupero delle proprietà');
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
      setError('Errore di connessione');
    } finally {
      setLoadingProperties(false);
    }
  };

  // Handle renting a property
  const handleRentProperty = async (propertyId: string, depositMonths: number = 1) => {
    try {
      const response = await fetch(`${API_BASE_URL}/game/housing/rent/${propertyId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ depositMonths }),
      });

      const data = await response.json();
      
      if (response.ok && data.result) {
        alert('Proprietà affittata con successo!');
        setShowRentModal(false);
        setSelectedProperty(null);
        onPropertyRented();
        onClose();
      } else {
        alert(`Errore nell'affitto: ${data.error || 'Errore sconosciuto'}`);
      }
    } catch (error) {
      console.error('Error renting property:', error);
      alert('Errore di connessione durante l\'affitto');
    }
  };

  // Handle purchasing a property
  const handlePurchaseProperty = async (propertyId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/game/housing/purchase/${propertyId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data = await response.json();
      
      if (response.ok && data.result) {
        alert('Proprietà acquistata con successo!');
        setShowPurchaseModal(false);
        setSelectedProperty(null);
        onPropertyRented();
        onClose();
      } else {
        alert(`Errore nell'acquisto: ${data.error || 'Errore sconosciuto'}`);
      }
    } catch (error) {
      console.error('Error purchasing property:', error);
      alert('Errore di connessione durante l\'acquisto');
    }
  };

  useEffect(() => {
    fetchDistricts();
  }, []);

  useEffect(() => {
    if (selectedDistrict) {
      fetchPropertiesInDistrict(selectedDistrict);
    } else {
      setAvailableProperties([]);
    }
  }, [selectedDistrict]);

  // Helper functions
  const formatCurrency = (amount: number) => {
    return `${amount} pence`;
  };

  const getPropertyTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'basic_room': 'Camera Base',
      'furnished_room': 'Camera Ammobiliata',
      'luxury_suite': 'Suite di Lusso',
      'small_house': 'Casa Piccola',
      'large_house': 'Casa Grande',
      'mansion': 'Villa'
    };
    return labels[type] || type;
  };

  const getConditionLabel = (condition: string) => {
    const labels: Record<string, string> = {
      'poor': 'Scarsa',
      'fair': 'Discreta',
      'good': 'Buona',
      'excellent': 'Eccellente'
    };
    return labels[condition] || condition;
  };

  const getSafetyLabel = (rating: string) => {
    const labels: Record<string, string> = {
      'very_dangerous': '🔴 Molto Pericoloso',
      'dangerous': '🟠 Pericoloso',
      'unsafe': '🟡 Non Sicuro',
      'safe': '🟢 Sicuro',
      'very_safe': '🟢 Molto Sicuro'
    };
    return labels[rating] || rating;
  };

  const getWaterSupplyLabel = (supply: string) => {
    const labels: Record<string, string> = {
      'none': 'Nessuno',
      'shared': 'Condiviso',
      'private': 'Privato'
    };
    return labels[supply] || supply;
  };

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent} style={{ maxWidth: '900px', maxHeight: '80vh', overflow: 'auto' }}>
        <div className={styles.modalHeader}>
          <h4>🔍 Cerca Proprietà</h4>
          <button onClick={onClose} className={styles.closeButton}>
            ✕
          </button>
        </div>
        
        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.loading}>Caricamento distretti...</div>
          ) : error ? (
            <div className={styles.error}>
              {error}
              <button onClick={fetchDistricts} className={styles.retryButton}>
                Riprova
              </button>
            </div>
          ) : (
            <>
              {/* District Selection */}
              <div className={styles.districtSelection}>
                <h5>Seleziona un Distretto</h5>
                <div className={styles.districtGrid}>
                  {districts.map((district) => (
                    <div 
                      key={district.name}
                      className={`${styles.districtCard} ${selectedDistrict === district.name ? styles.selected : ''}`}
                      onClick={() => setSelectedDistrict(district.name)}
                    >
                      <div className={styles.districtName}>{district.name}</div>
                      <div className={styles.districtInfo}>
                        <div className={styles.safetyRating}>
                          {getSafetyLabel(district.safetyRating)}
                        </div>
                        <div className={styles.districtStats}>
                          <span>Affitto medio: {formatCurrency(district.averageRent)}</span>
                          <span>{district.propertyCount} proprietà disponibili</span>
                        </div>
                      </div>
                      <div className={styles.districtDescription}>
                        {district.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Property Listing */}
              {selectedDistrict && (
                <div className={styles.propertyListing}>
                  <h5>Proprietà Disponibili in {selectedDistrict}</h5>
                  
                  {loadingProperties ? (
                    <div className={styles.loading}>Caricamento proprietà...</div>
                  ) : availableProperties.length === 0 ? (
                    <div className={styles.noProperties}>
                      <p>Nessuna proprietà disponibile in questo distretto.</p>
                    </div>
                  ) : (
                    <div className={styles.propertiesList}>
                      {availableProperties.map((property) => (
                        <div key={property._id} className={styles.propertyCard}>
                          <div className={styles.propertyHeader}>
                            <div className={styles.propertyTitle}>
                              <h4>{property.locationId.name}</h4>
                              <span className={styles.district}>{property.district}</span>
                            </div>
                            <div className={styles.propertyType}>
                              {getPropertyTypeLabel(property.propertyType)}
                            </div>
                          </div>

                          <div className={styles.propertyDetails}>
                            <div className={styles.propertyInfo}>
                              <span><strong>Condizioni:</strong> {getConditionLabel(property.condition)}</span>
                              <span><strong>Stanze:</strong> {property.features.roomCount}</span>
                              <span><strong>Acqua:</strong> {getWaterSupplyLabel(property.features.waterSupply)}</span>
                            </div>

                            <div className={styles.propertyFeatures}>
                              {property.features.furnished && <span className={styles.feature}>📦 Ammobiliata</span>}
                              {property.features.hasKitchen && <span className={styles.feature}>🍳 Cucina</span>}
                              {property.features.hasPrivateBathroom && <span className={styles.feature}>🛁 Bagno Privato</span>}
                              {property.features.hasGarden && <span className={styles.feature}>🌿 Giardino</span>}
                              {property.features.hasBalcony && <span className={styles.feature}>🏛️ Balcone</span>}
                              {property.features.fireplace && <span className={styles.feature}>🔥 Camino</span>}
                              {property.features.gaslighting && <span className={styles.feature}>💡 Illuminazione a Gas</span>}
                            </div>

                            <div className={styles.financialInfo}>
                              {property.monthlyRent && (
                                <div className={styles.rentInfo}>
                                  <span><strong>Affitto:</strong> {formatCurrency(property.monthlyRent)}/mese</span>
                                  {property.deposit && (
                                    <span><strong>Cauzione:</strong> {formatCurrency(property.deposit)}</span>
                                  )}
                                </div>
                              )}
                              
                              {property.purchasePrice && (
                                <div className={styles.purchaseInfo}>
                                  <span><strong>Prezzo d'acquisto:</strong> {formatCurrency(property.purchasePrice)}</span>
                                </div>
                              )}
                              
                              {property.monthlyMaintenance > 0 && (
                                <span><strong>Manutenzione:</strong> {formatCurrency(property.monthlyMaintenance)}/mese</span>
                              )}
                            </div>

                            {property.locationId.description && (
                              <div className={styles.propertyDescription}>
                                {property.locationId.description}
                              </div>
                            )}
                          </div>

                          <div className={styles.propertyActions}>
                            {property.monthlyRent && (
                              <button
                                onClick={() => {
                                  setSelectedProperty(property);
                                  setShowRentModal(true);
                                }}
                                className={styles.rentButton}
                              >
                                🏠 Affitta ({formatCurrency(property.monthlyRent)}/mese)
                              </button>
                            )}
                            
                            {property.purchasePrice && (
                              <button
                                onClick={() => {
                                  setSelectedProperty(property);
                                  setShowPurchaseModal(true);
                                }}
                                className={styles.purchaseButton}
                              >
                                💰 Acquista ({formatCurrency(property.purchasePrice)})
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Rent Confirmation Modal */}
      {showRentModal && selectedProperty && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h4>🏠 Conferma Affitto</h4>
              <button 
                onClick={() => setShowRentModal(false)}
                className={styles.closeButton}
              >
                ✕
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <p><strong>Proprietà:</strong> {selectedProperty.locationId.name}</p>
              <p><strong>Distretto:</strong> {selectedProperty.district}</p>
              <p><strong>Affitto Mensile:</strong> {formatCurrency(selectedProperty.monthlyRent || 0)}</p>
              {selectedProperty.deposit && (
                <p><strong>Cauzione:</strong> {formatCurrency(selectedProperty.deposit)}</p>
              )}
              
              <div className={styles.confirmationActions}>
                <button 
                  onClick={() => handleRentProperty(selectedProperty._id, 1)}
                  className={styles.confirmButton}
                >
                  Conferma Affitto
                </button>
                <button 
                  onClick={() => setShowRentModal(false)}
                  className={styles.cancelButton}
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Confirmation Modal */}
      {showPurchaseModal && selectedProperty && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h4>💰 Conferma Acquisto</h4>
              <button 
                onClick={() => setShowPurchaseModal(false)}
                className={styles.closeButton}
              >
                ✕
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <p><strong>Proprietà:</strong> {selectedProperty.locationId.name}</p>
              <p><strong>Distretto:</strong> {selectedProperty.district}</p>
              <p><strong>Prezzo d'Acquisto:</strong> {formatCurrency(selectedProperty.purchasePrice || 0)}</p>
              <p><strong>Manutenzione Mensile:</strong> {formatCurrency(selectedProperty.monthlyMaintenance)}</p>
              
              <div className={styles.confirmationActions}>
                <button 
                  onClick={() => handlePurchaseProperty(selectedProperty._id)}
                  className={styles.confirmButton}
                >
                  Conferma Acquisto
                </button>
                <button 
                  onClick={() => setShowPurchaseModal(false)}
                  className={styles.cancelButton}
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyBrowser;