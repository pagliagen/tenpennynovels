/**
 * MarketItemsTab — "Strumenti" tab: browse + buy the general-store catalog.
 */

import React, { useMemo, useState } from 'react';

import { usePurchaseItem } from '@/hooks/useMarketCatalog';
import { useUIStore } from '@/store/uiStore';
import type { GeneralStoreResponse, MarketItem, PaymentMethod } from '@/types/economy';

import { PurchaseModal } from './PurchaseModal';
import styles from '@/styles/components/windows/market/Market.module.scss';

interface MarketItemsTabProps {
  data: GeneralStoreResponse;
}

function requirementsHint(item: MarketItem): string | null {
  const req = item.requirements;
  if (!req) return null;
  const parts: string[] = [];
  if (req.requiredOccupations?.length) parts.push(`occupazione: ${req.requiredOccupations.join(', ')}`);
  if (req.minimumSkills && Object.keys(req.minimumSkills).length) {
    parts.push(Object.entries(req.minimumSkills).map(([skill, min]) => `${skill} ${min}+`).join(', '));
  }
  if (req.requiredSocialClass?.length) parts.push(`classe sociale: ${req.requiredSocialClass.join(', ')}`);
  return parts.length ? `Richiede: ${parts.join(' · ')}` : null;
}

export function MarketItemsTab({ data }: MarketItemsTabProps): React.ReactElement {
  const [category, setCategory] = useState<string>('');
  const [search, setSearch] = useState('');
  const [purchasingItem, setPurchasingItem] = useState<MarketItem | null>(null);

  const purchaseItem = usePurchaseItem();
  const addToast = useUIStore((s) => s.addToast);

  const categories = useMemo(
    () => Array.from(new Set(data.items.map((item) => item.category))).sort(),
    [data.items]
  );

  const filteredItems = useMemo(() => {
    return data.items.filter((item) => {
      if (category && item.category !== category) return false;
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data.items, category, search]);

  const handleConfirmPurchase = async (paymentMethod: PaymentMethod) => {
    if (!purchasingItem) return;
    try {
      await purchaseItem.mutateAsync({ itemId: purchasingItem.id, paymentMethod });
      addToast({ type: 'success', message: `${purchasingItem.name} acquistato con successo`, duration: 3000 });
      setPurchasingItem(null);
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Acquisto non riuscito',
        duration: 4000,
      });
    }
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.filters}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome…"
          className={styles.searchInput}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={styles.select}>
          <option value="">Tutte le categorie</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className={styles.itemGrid}>
        {filteredItems.length === 0 ? (
          <p className={styles.emptyState}>Nessun oggetto trovato.</p>
        ) : (
          filteredItems.map((item) => {
            const hint = requirementsHint(item);
            const purchasable = item.canPurchaseWithCash || item.canPurchaseWithCredit;
            return (
              <div key={item.id} className={styles.itemCard}>
                <div className={styles.itemCardHeader}>
                  <span className={styles.itemName}>{item.name}</span>
                  <span className={styles.itemPrice}>{item.priceFormatted}</span>
                </div>
                <p className={styles.itemDescription}>{item.description}</p>
                {hint && !item.canPurchase && <p className={styles.itemRequirement}>{hint}</p>}
                <button
                  className={styles.primaryButton}
                  disabled={!item.canPurchase || !purchasable}
                  onClick={() => setPurchasingItem(item)}
                >
                  Compra
                </button>
              </div>
            );
          })
        )}
      </div>

      {purchasingItem && (
        <PurchaseModal
          item={purchasingItem}
          isPending={purchaseItem.isPending}
          onConfirm={handleConfirmPurchase}
          onClose={() => setPurchasingItem(null)}
        />
      )}
    </div>
  );
}
