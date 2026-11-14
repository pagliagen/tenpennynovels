/**
 * Market Content Component
 *
 * Mercato: schermata a scaffale con i reparti (servizi, farmacia, camuffamento, armi,
 * trasporti, attrezzi del mestiere). Ogni etichetta apre il proprio reparto.
 *
 * @module components/windows/contents/MarketContent
 */

'use client';

import React, { useMemo, useState } from 'react';

import { useEconomyServices } from '@/hooks/useEconomyServices';
import { useGeneralStore } from '@/hooks/useMarketCatalog';

import { MarketSectionView } from './market/MarketSectionView';
import { MarketShelf } from './market/MarketShelf';
import type { MarketSectionId } from './market/shelfConfig';
import styles from '@/styles/components/windows/market/Market.module.scss';

export function MarketContent(): React.ReactElement {
  const [section, setSection] = useState<MarketSectionId | null>(null);

  const generalStore = useGeneralStore();
  const services = useEconomyServices();

  const isLoading = generalStore.isLoading || services.isLoading;
  const error = generalStore.error || services.error;

  const finances = generalStore.data?.character?.finances;

  // Conteggi per reparto, mostrati al passaggio sulle etichette
  const counts = useMemo(() => {
    const result: Partial<Record<MarketSectionId, number>> = {};
    if (generalStore.data) {
      for (const item of generalStore.data.items) {
        if (!item.marketSection) continue;
        const id = item.marketSection as MarketSectionId;
        result[id] = (result[id] ?? 0) + 1;
      }
    }
    if (services.data) result.servizi = services.data.catalog.length;
    return result;
  }, [generalStore.data, services.data]);

  // Lo scaffale è a tutta finestra, senza intestazione: titolo e riepilogo dei penny compaiono solo dentro un reparto.
  return (
    <div className={styles.marketContainer}>
      {section === null ? (
        <>
          {error && <p className={styles.modalWarning}>⚠️ Errore nel caricamento del mercato. Riprova più tardi.</p>}
          <MarketShelf counts={counts} onSelect={setSection} />
        </>
      ) : (
        <>
          <div className={styles.header}>
            <h2 className={styles.title}>🏪 Mercato</h2>

            {finances && (
              <div className={styles.walletBar}>
                <span>Contanti: {finances.cash} penny</span>
                <span>Deposito: {finances.bankDeposit} penny</span>
                <span>Classe sociale: {finances.socialClass}</span>
                <span>Rendita settimanale: {finances.creditLine.currentAvailable}/{finances.creditLine.maxWeekly} penny</span>
                {services.data && <span>Valore di Credito: {services.data.available}/{services.data.capacity}</span>}
              </div>
            )}
          </div>

          <MarketSectionView
            section={section}
            generalStore={generalStore.data}
            services={services.data}
            isLoading={isLoading}
            hasError={Boolean(error)}
            onBack={() => setSection(null)}
          />
        </>
      )}
    </div>
  );
}
