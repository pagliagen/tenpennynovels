import React, { useState, useEffect } from 'react';
import styles from './HousingDashboard.module.scss';
import PropertyBrowser from './PropertyBrowser';

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

interface HousingProperty {
  _id: string;
  locationId: {
    _id: string;
    name: string;
    description?: string;
  };
  propertyType: 'basic_room' | 'furnished_room' | 'luxury_suite' | 'small_house' | 'large_house' | 'mansion';
  district: string;
  address?: string;
  ownershipType: 'rental' | 'owned' | 'available';
  monthlyRent?: number;
  purchasePrice?: number;
  monthlyMaintenance: number;
  deposit?: number;
  features: PropertyFeatures;
  condition: 'poor' | 'fair' | 'good' | 'excellent';
  isAvailable: boolean;
  rentPaidUntil?: string;
  lastRentPayment?: string;
  leaseStart?: string;
  leaseEnd?: string;
}

interface HousingDashboardProps {
  characterId: string;
}

const HousingDashboard: React.FC<HousingDashboardProps> = ({ characterId }) => {
  const [properties, setProperties] = useState<HousingProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPropertyBrowser, setShowPropertyBrowser] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<HousingProperty | null>(null);
  const [rentPaymentModal, setRentPaymentModal] = useState(false);

  // Fetch character's properties
  const fetchProperties = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/game/housing/my-properties`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProperties(data.data?.properties || []);
        } else {
          setError('Impossibile caricare le proprietà');
        }
      } else if (response.status === 404) {
        // Character has no properties yet
        setProperties([]);
      } else {
        setError('Errore nel recupero delle proprietà');
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  // Pay rent for a property
  const handlePayRent = async (propertyId: string, monthsAdvance: number = 1) => {
    try {
      const response = await fetch(`${API_BASE_URL}/game/housing/pay-rent/${propertyId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ monthsAdvance }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Refresh properties after payment
        await fetchProperties();
        setRentPaymentModal(false);
        setSelectedProperty(null);
        
        // You could add a success notification here
        alert(`Affitto pagato con successo! Pagato fino al: ${new Date(data.data.rentPaidUntil).toLocaleDateString()}`);
      } else {
        alert(`Errore nel pagamento: ${data.error || 'Errore sconosciuto'}`);
      }
    } catch (error) {
      console.error('Error paying rent:', error);
      alert('Errore di connessione durante il pagamento');
    }
  };

  useEffect(() => {
    if (characterId) {
      fetchProperties();
    }
  }, [characterId]);

  // Helper functions
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const formatCurrency = (amount: number) => {
    return `${amount} pence`;
  };

  const getRentStatus = (property: HousingProperty) => {
    if (property.ownershipType === 'owned') {
      return { status: 'owned', className: 'owned', text: 'Proprietà' };
    }
    
    if (!property.rentPaidUntil) {
      return { status: 'unknown', className: 'warning', text: 'Non disponibile' };
    }
    
    const rentDueDate = new Date(property.rentPaidUntil);
    const today = new Date();
    const daysUntilDue = Math.ceil((rentDueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
    
    if (daysUntilDue < 0) {
      return { status: 'overdue', className: 'overdue', text: `Scaduto da ${Math.abs(daysUntilDue)} giorni` };
    } else if (daysUntilDue <= 3) {
      return { status: 'due-soon', className: 'warning', text: `Scade tra ${daysUntilDue} giorni` };
    } else {
      return { status: 'current', className: 'current', text: `Pagato fino al ${formatDate(property.rentPaidUntil)}` };
    }
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

  if (loading) {
    return (
      <div className={styles.housingDashboard}>
        <h3>🏠 Le Mie Proprietà</h3>
        <div className={styles.loading}>Caricamento proprietà...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.housingDashboard}>
        <h3>🏠 Le Mie Proprietà</h3>
        <div className={styles.error}>
          {error}
          <button onClick={fetchProperties} className={styles.retryButton}>
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.housingDashboard}>
      <div className={styles.header}>
        <h3>🏠 Le Mie Proprietà</h3>
        <button 
          onClick={() => setShowPropertyBrowser(true)}
          className={styles.browseButton}
        >
          Cerca Proprietà
        </button>
      </div>

      {properties.length === 0 ? (
        <div className={styles.noProperties}>
          <div className={styles.emptyState}>
            <h4>Nessuna Proprietà</h4>
            <p>Non possiedi o affitti ancora nessuna proprietà a Londra.</p>
            <button 
              onClick={() => setShowPropertyBrowser(true)}
              className={styles.browseButton}
            >
              Esplora Proprietà Disponibili
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.propertiesList}>
          {properties.map((property) => {
            const rentStatus = getRentStatus(property);
            
            return (
              <div key={property._id} className={styles.propertyCard}>
                <div className={styles.propertyHeader}>
                  <div className={styles.propertyTitle}>
                    <h4>{property.locationId.name}</h4>
                    <span className={styles.district}>{property.district}</span>
                  </div>
                  <div className={`${styles.rentStatus} ${styles[rentStatus.className]}`}>
                    {rentStatus.text}
                  </div>
                </div>

                <div className={styles.propertyDetails}>
                  <div className={styles.propertyInfo}>
                    <span><strong>Tipo:</strong> {getPropertyTypeLabel(property.propertyType)}</span>
                    <span><strong>Condizioni:</strong> {getConditionLabel(property.condition)}</span>
                    <span><strong>Stanze:</strong> {property.features.roomCount}</span>
                  </div>

                  <div className={styles.propertyFeatures}>
                    {property.features.furnished && <span className={styles.feature}>📦 Ammobiliata</span>}
                    {property.features.hasKitchen && <span className={styles.feature}>🍳 Cucina</span>}
                    {property.features.hasPrivateBathroom && <span className={styles.feature}>🛁 Bagno Privato</span>}
                    {property.features.hasGarden && <span className={styles.feature}>🌿 Giardino</span>}
                    {property.features.fireplace && <span className={styles.feature}>🔥 Camino</span>}
                    {property.features.gaslighting && <span className={styles.feature}>💡 Illuminazione a Gas</span>}
                  </div>

                  <div className={styles.financialInfo}>
                    {property.ownershipType === 'rental' && property.monthlyRent && (
                      <div className={styles.rentInfo}>
                        <span><strong>Affitto Mensile:</strong> {formatCurrency(property.monthlyRent)}</span>
                        {property.lastRentPayment && (
                          <span><strong>Ultimo Pagamento:</strong> {formatDate(property.lastRentPayment)}</span>
                        )}
                      </div>
                    )}
                    
                    {property.monthlyMaintenance > 0 && (
                      <span><strong>Manutenzione:</strong> {formatCurrency(property.monthlyMaintenance)}/mese</span>
                    )}
                  </div>
                </div>

                <div className={styles.propertyActions}>
                  <button 
                    onClick={() => {/* Navigate to property location */}}
                    className={styles.visitButton}
                  >
                    🚪 Entra
                  </button>
                  
                  {property.ownershipType === 'rental' && rentStatus.status !== 'owned' && (
                    <button
                      onClick={() => {
                        setSelectedProperty(property);
                        setRentPaymentModal(true);
                      }}
                      className={`${styles.payRentButton} ${rentStatus.status === 'overdue' || rentStatus.status === 'due-soon' ? styles.urgent : ''}`}
                    >
                      💰 Paga Affitto
                    </button>
                  )}
                  
                  <button
                    onClick={() => setSelectedProperty(property)}
                    className={styles.detailsButton}
                  >
                    📋 Dettagli
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rent Payment Modal */}
      {rentPaymentModal && selectedProperty && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h4>💰 Pagamento Affitto</h4>
              <button 
                onClick={() => setRentPaymentModal(false)}
                className={styles.closeButton}
              >
                ✕
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <p><strong>Proprietà:</strong> {selectedProperty.locationId.name}</p>
              <p><strong>Affitto Mensile:</strong> {formatCurrency(selectedProperty.monthlyRent || 0)}</p>
              
              <div className={styles.paymentOptions}>
                <button 
                  onClick={() => handlePayRent(selectedProperty._id, 1)}
                  className={styles.payButton}
                >
                  Paga 1 Mese ({formatCurrency(selectedProperty.monthlyRent || 0)})
                </button>
                
                <button 
                  onClick={() => handlePayRent(selectedProperty._id, 3)}
                  className={styles.payButton}
                >
                  Paga 3 Mesi ({formatCurrency((selectedProperty.monthlyRent || 0) * 3)})
                </button>
                
                <button 
                  onClick={() => handlePayRent(selectedProperty._id, 6)}
                  className={styles.payButton}
                >
                  Paga 6 Mesi ({formatCurrency((selectedProperty.monthlyRent || 0) * 6)})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Property Browser */}
      {showPropertyBrowser && (
        <PropertyBrowser 
          onClose={() => setShowPropertyBrowser(false)}
          onPropertyRented={fetchProperties}
        />
      )}
    </div>
  );
};

export default HousingDashboard;