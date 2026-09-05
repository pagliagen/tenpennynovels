/**
 * MarketItemsTab — "Strumenti" tab: browse + buy the general-store catalog.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { usePurchaseItem } from '@/hooks/useMarketCatalog';
import { useUIStore } from '@/store/uiStore';
import type { GeneralStoreResponse, MarketItem, PaymentMethod } from '@/types/economy';

import { PurchaseModal } from './PurchaseModal';
import styles from '@/styles/components/windows/market/Market.module.scss';

interface MarketItemsTabProps {
  data: GeneralStoreResponse;
}

const DEFAULT_ITEM_IMAGE = '/images/objects/default-image.png';
const MIN_NAME_FONT_SIZE = 10;
const MAX_NAME_FONT_SIZE = 16;

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

// Shrinks the font size until the name fits on a single line, instead of truncating it.
function FitItemName({ name }: { name: string }): React.ReactElement {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      let size = MAX_NAME_FONT_SIZE;
      el.style.fontSize = `${size}px`;
      while (el.scrollWidth > el.clientWidth && size > MIN_NAME_FONT_SIZE) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [name]);

  return (
    <span ref={ref} className={styles.itemName}>
      {name}
    </span>
  );
}

export function MarketItemsTab({ data }: MarketItemsTabProps): React.ReactElement {
  const [category, setCategory] = useState<string>('');
  const [search, setSearch] = useState('');
  const [purchasingItem, setPurchasingItem] = useState<MarketItem | null>(null);

  const purchaseItem = usePurchaseItem();
  const addToast = useUIStore((s) => s.addToast);

  const categories = useMemo(
    () => Array.from(new Set(data.items.map((item) => item.category))).sort((a, b) => a.localeCompare(b)),
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
                <div className={styles.itemImageWrapper}>
                  <img
                    src={item.imageUrl || DEFAULT_ITEM_IMAGE}
                    alt={item.name}
                    className={styles.itemImage}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = DEFAULT_ITEM_IMAGE;
                    }}
                  />
                  <div className={styles.itemImageOverlay}>{item.description}</div>
                </div>
                <FitItemName name={item.name} />
                {hint && !item.canPurchase && <p className={styles.itemRequirement}>{hint}</p>}
                <button
                  className={styles.primaryButton}
                  disabled={!item.canPurchase || !purchasable}
                  onClick={() => setPurchasingItem(item)}
                >
                  Compra ({item.priceFormatted})
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
