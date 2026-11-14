/**
 * MarketItemsTab — un reparto del Mercato: sfoglia e compra gli item del catalogo con quel `marketSection`.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useOccupations } from '@/hooks/useCharacterCreation';
import { usePurchaseItem } from '@/hooks/useMarketCatalog';
import { useUIStore } from '@/store/uiStore';
import type { GeneralStoreResponse, MarketItem, PaymentMethod } from '@/types/economy';

import { PurchaseModal } from './PurchaseModal';
import { SUBCATEGORY_LABELS, type MarketSectionId } from './shelfConfig';
import styles from '@/styles/components/windows/market/Market.module.scss';

interface MarketItemsTabProps {
  data: GeneralStoreResponse;
  /** Reparto da mostrare (tutti tranne «servizi», che ha un'altra vista). */
  section: Exclude<MarketSectionId, 'servizi'>;
}

/** Valore del filtro occupazione: gli attrezzi del mestiere del personaggio. */
const MY_OCCUPATION = '__mine';

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

export function MarketItemsTab({ data, section }: MarketItemsTabProps): React.ReactElement {
  const [subcategory, setSubcategory] = useState<string>('');
  const [occupation, setOccupation] = useState<string>('');
  const [search, setSearch] = useState('');
  const [purchasingItem, setPurchasingItem] = useState<MarketItem | null>(null);

  const purchaseItem = usePurchaseItem();
  const addToast = useUIStore((s) => s.addToast);
  const occupations = useOccupations();

  const isTradeSection = section === 'mestiere';

  const sectionItems = useMemo(
    () => data.items.filter((item) => item.marketSection === section),
    [data.items, section]
  );

  // Sottocategorie come chip (non nel reparto «mestiere», dove la sottocategoria è il gruppo di occupazioni)
  const subcategories = useMemo(() => {
    if (isTradeSection) return [];
    return Array.from(new Set(sectionItems.map((item) => item.subcategory).filter((v): v is string => Boolean(v))))
      .sort((a, b) => (SUBCATEGORY_LABELS[a] ?? a).localeCompare(SUBCATEGORY_LABELS[b] ?? b));
  }, [sectionItems, isTradeSection]);

  // Occupazioni per cui esiste almeno un attrezzo, con il nome (id → nome dall'elenco delle occupazioni)
  const occupationOptions = useMemo(() => {
    if (!isTradeSection) return [];
    const names = new Map((occupations.data ?? []).map((o) => [o.id, o.name]));
    const ids = new Set(sectionItems.flatMap((item) => item.tradeOccupations ?? []));
    return Array.from(ids)
      .map((id) => ({ id, name: names.get(id) }))
      .filter((o): o is { id: string; name: string } => Boolean(o.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sectionItems, occupations.data, isTradeSection]);

  const filteredItems = useMemo(() => {
    const filtered = sectionItems.filter((item) => {
      if (subcategory && item.subcategory !== subcategory) return false;
      if (occupation === MY_OCCUPATION && !item.forMyOccupation) return false;
      if (occupation && occupation !== MY_OCCUPATION && !(item.tradeOccupations ?? []).includes(occupation)) return false;
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    // Nel reparto del mestiere gli attrezzi del proprio mestiere vengono per primi
    return isTradeSection
      ? [...filtered].sort((a, b) => Number(Boolean(b.forMyOccupation)) - Number(Boolean(a.forMyOccupation)))
      : filtered;
  }, [sectionItems, subcategory, occupation, search, isTradeSection]);

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
        {isTradeSection && (
          <select value={occupation} onChange={(e) => setOccupation(e.target.value)} className={styles.select}>
            <option value="">Tutti i mestieri</option>
            <option value={MY_OCCUPATION}>Il mio mestiere</option>
            {occupationOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        )}
      </div>

      {subcategories.length > 1 && (
        <div className={styles.chips} role="group" aria-label="Filtra per tipo">
          <button
            type="button"
            className={`${styles.chip} ${subcategory === '' ? styles.chipActive : ''}`}
            onClick={() => setSubcategory('')}
          >
            Tutti
          </button>
          {subcategories.map((sub) => (
            <button
              key={sub}
              type="button"
              className={`${styles.chip} ${subcategory === sub ? styles.chipActive : ''}`}
              onClick={() => setSubcategory(sub)}
            >
              {SUBCATEGORY_LABELS[sub] ?? sub}
            </button>
          ))}
        </div>
      )}

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
                {item.forMyOccupation && <span className={styles.mineBadge}>Il tuo mestiere</span>}
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
