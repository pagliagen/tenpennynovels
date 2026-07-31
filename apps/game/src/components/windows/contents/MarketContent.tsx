/**
 * Market Content Component
 *
 * Mercato: catalogo strumenti (general-store) + servizi continuativi
 * (servitù, comunicazioni, trasporti, sicurezza).
 *
 * @module components/windows/contents/MarketContent
 */

'use client';

import React, { useState } from 'react';

import { useEconomyServices } from '@/hooks/useEconomyServices';
import { useGeneralStore } from '@/hooks/useMarketCatalog';

import { MarketItemsTab } from './market/MarketItemsTab';
import { MarketServicesTab } from './market/MarketServicesTab';
import styles from '@/styles/components/windows/market/Market.module.scss';

export function MarketContent(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'strumenti' | 'servizi'>('strumenti');

  const generalStore = useGeneralStore();
  const services = useEconomyServices();

  const isLoading = generalStore.isLoading || services.isLoading;
  const error = generalStore.error || services.error;

  const finances = generalStore.data?.character?.finances;

  return (
    <div className={styles.marketContainer}>
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

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'strumenti' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('strumenti')}
        >
          Strumenti
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'servizi' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('servizi')}
        >
          Servizi
        </button>
      </div>

      {isLoading && <p className={styles.emptyState}>Caricamento del mercato in corso…</p>}
      {error && <p className={styles.modalWarning}>⚠️ Errore nel caricamento del mercato. Riprova più tardi.</p>}

      {!isLoading && !error && activeTab === 'strumenti' && generalStore.data && (
        <MarketItemsTab data={generalStore.data} />
      )}
      {!isLoading && !error && activeTab === 'servizi' && services.data && (
        <MarketServicesTab data={services.data} />
      )}
    </div>
  );
}
