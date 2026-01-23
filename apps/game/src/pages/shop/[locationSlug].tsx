import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { GameWrapper } from '@/components/GameWrapper';
import styles from '@/styles/pages/Shop.module.scss';

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  priceFormatted: string;
  inStock: boolean;
  currentStock: number;
  maxStock: number;
  category: string;
  requirements: any;
  canPurchase: boolean;
  canPurchaseWithCash?: boolean;
  canPurchaseWithCredit?: boolean;
  creditEligible?: boolean;
  socialClasses?: string[];
}

interface ShopData {
  location: {
    id: string;
    name: string;
    slug: string;
    description: string;
  };
  shop: {
    items: ShopItem[];
  };
  character?: {
    finances: {
      cash: number;
      bankDeposit: number;
      totalWealth: number;
      socialClass: string;
      creditLine: {
        maxWeekly: number;
        currentAvailable: number;
        nextResetDate: string;
      };
    };
  };
  filters: {
    current: string;
    available: string[];
  };
}

function ShopPageContent() {
  const router = useRouter();
  const { locationSlug } = router.query;

  console.log('🏪 ShopPageContent render - router.query:', router.query, 'locationSlug:', locationSlug);

  const [shopData, setShopData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'credit_only'>('all');
  const [purchasing, setPurchasing] = useState<string | null>(null);

  // Fetch shop data
  useEffect(() => {
    console.log('🏪 useEffect triggered - locationSlug:', locationSlug, 'router.isReady:', router.isReady);
    if (!router.isReady || !locationSlug) {
      console.log('🏪 Skipping fetch - router not ready or missing locationSlug');
      return;
    }

    const fetchShopData = async () => {
      try {
        console.log('🏪 Fetching shop data for:', locationSlug, 'with filter:', filter);
        setLoading(true);
        const response = await fetch(
          `${API_GATEWAY_URL}/game/economy/shops/${locationSlug}?filter=${filter}`,
          {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('🏪 Shop response:', response.status, response.statusText);

        if (!response.ok) {
          throw new Error('Failed to fetch shop data');
        }

        const result = await response.json();
        console.log('🏪 Shop data result:', result);

        if (result.result) {
          setShopData(result.data);
          setError(null);
        } else {
          setError(result.error || 'Failed to load shop');
        }
      } catch (err) {
        console.error('🏪 Shop fetch error:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchShopData();
  }, [router.isReady, locationSlug, filter]);

  // Purchase item
  const handlePurchase = async (itemId: string) => {
    try {
      setPurchasing(itemId);

      const response = await fetch(`${API_GATEWAY_URL}/game/economy/purchase`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          itemId,
          quantity: 1
        })
      });

      const result = await response.json();
      if (result.result) {
        // Refresh shop data
        window.location.reload();
      } else {
        alert(result.error || 'Errore nell\'acquisto dell\'articolo');
      }
    } catch (err) {
      alert('Si è verificato un errore durante l\'acquisto');
    } finally {
      setPurchasing(null);
    }
  };

  // Format currency (standardized to penny)
  const formatCurrency = (pence: number): string => {
    return `${pence} penny`;
  };

  // Get item image path
  const getItemImagePath = (itemName: string): string => {
    // Convert item name to image filename (lowercase, replace spaces with hyphens)
    const imageName = itemName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]/g, '');
    return `/images/objects/${imageName}.png`;
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>Caricamento negozio...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <h1>Negozio Non Disponibile</h1>
        <p>{error}</p>
        <button
          onClick={() => router.back()}
          className={styles.backButton}
        >
          Torna Indietro
        </button>
      </div>
    );
  }

  if (!shopData) {
    return (
      <div className={styles.error}>
        <h1>Negozio Non Trovato</h1>
        <p>Il negozio richiesto non è stato trovato.</p>
      </div>
    );
  }

  const { location, shop, character, filters } = shopData;

  return (
    <div className={styles.shopContainer}>
      {/* Header */}
      <div className={styles.header}>
        <h1>{location.name} - Negozio</h1>
        <p className={styles.description}>{location.description}</p>

        <button
          onClick={() => router.back()}
          className={styles.backButton}
        >
          ← Torna alla Location
        </button>
      </div>

      {/* Character Finances */}
      {character && (
        <div className={styles.financesPanel}>
          <h3>Le Tue Finanze</h3>
          <div className={styles.financesGrid}>
            <div className={styles.financeItem}>
              <span>Contanti:</span>
              <span>{formatCurrency(character.finances.cash)}</span>
            </div>
            <div className={styles.financeItem}>
              <span>Deposito Bancario:</span>
              <span>{formatCurrency(character.finances.bankDeposit)}</span>
            </div>
            <div className={styles.financeItem}>
              <span>Patrimonio Totale:</span>
              <span>{formatCurrency(character.finances.totalWealth)}</span>
            </div>
            <div className={styles.financeItem}>
              <span>Classe Sociale:</span>
              <span>{character.finances.socialClass}</span>
            </div>
            <div className={styles.financeItem}>
              <span>Credito Disponibile:</span>
              <span>{formatCurrency(character.finances.creditLine.currentAvailable)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filtersPanel}>
        <h3>Filtra Articoli</h3>
        <div className={styles.filterButtons}>
          {filters.available.map((filterOption) => (
            <button
              key={filterOption}
              className={`${styles.filterButton} ${filter === filterOption ? styles.active : ''
                }`}
              onClick={() => setFilter(filterOption as 'all' | 'credit_only')}
            >
              {filterOption === 'all' ? 'Tutti gli Articoli' : 'Solo Linea di Credito'}
            </button>
          ))}
        </div>
      </div>

      {/* Shop Items */}
      <div className={styles.itemsContainer}>
        <h3>Articoli Disponibili ({shop.items.length})</h3>

        {shop.items.length === 0 ? (
          <div className={styles.noItems}>
            <p>Nessun articolo disponibile con i filtri attuali.</p>
          </div>
        ) : (
          <div className={styles.itemsGrid}>
            {shop.items.map((item) => (
              <div key={item.id} className={styles.itemCard}>
                {/* Item Image */}
                <div className={styles.itemImageContainer}>
                  <img
                    src={getItemImagePath(item.name)}
                    alt={item.name}
                    className={styles.itemImage}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/objects/default-image.png';
                    }}
                  />

                  {/* Item Header */}
                  <div className={styles.itemDetails}>
                    <div className={styles.itemHeader}>
                      <h4>{item.name}</h4>
                      <span className={styles.category}>{item.category}</span>
                    </div>

                    {/* Description */}
                    <p className={styles.description}>{item.description}</p>
                  </div>
                </div>

                {/* Stock Info */}
                <div className={styles.stock}>
                  Disponibilità: {item.currentStock}/{item.maxStock}
                </div>

                {/* Financial info */}
                {character && (
                  <div className={styles.financialInfo}>
                    {item.canPurchaseWithCash && (
                      <span className={styles.canPurchaseCash}>💰 Acquistabile con contanti</span>
                    )}
                    {item.creditEligible && (
                      <span className={`${styles.creditEligible} ${item.canPurchaseWithCredit ? styles.available : styles.unavailable
                        }`}>
                        🏦 {item.canPurchaseWithCredit ? 'Acquistabile a credito' : 'Credito insufficiente'}
                      </span>
                    )}
                    {item.socialClasses && item.socialClasses.length > 0 && (
                      <span className={styles.socialClasses}>
                        👑 Richiede: {item.socialClasses.join(', ')}
                      </span>
                    )}
                  </div>
                )}

                {/* Price and Purchase button on same row */}
                <div className={styles.purchaseRow}>
                  <div className={styles.price}>
                    <strong>{item.priceFormatted}</strong>
                  </div>

                  {!item.inStock ? (
                    <button className={styles.outOfStock} disabled>
                      Esaurito
                    </button>
                  ) : !item.canPurchase ? (
                    <button className={styles.cannotPurchase} disabled>
                      Requisiti Non Soddisfatti
                    </button>
                  ) : character && !item.canPurchaseWithCash && !item.canPurchaseWithCredit ? (
                    <button className={styles.cannotAfford} disabled>
                      Non Puoi Permettertelo
                    </button>
                  ) : (
                    <button
                      className={styles.purchaseButton}
                      onClick={() => handlePurchase(item.id)}
                      disabled={purchasing === item.id}
                    >
                      {purchasing === item.id ? 'Acquistando...' : 'Acquista'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <GameWrapper>
      <ShopPageContent />
    </GameWrapper>
  );
} 