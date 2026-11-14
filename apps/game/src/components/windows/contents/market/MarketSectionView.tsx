/**
 * MarketSectionView — un reparto del Mercato, con il ritorno allo scaffale.
 * «Servizi» mostra i servizi mensili; gli altri reparti il catalogo filtrato per `marketSection`.
 */

import React from 'react';

import type { EconomyServicesResponse, GeneralStoreResponse } from '@/types/economy';

import { MarketItemsTab } from './MarketItemsTab';
import { MarketServicesTab } from './MarketServicesTab';
import { SECTION_TITLES, type MarketSectionId } from './shelfConfig';
import styles from '@/styles/components/windows/market/Market.module.scss';

interface MarketSectionViewProps {
  section: MarketSectionId;
  generalStore: GeneralStoreResponse | undefined;
  services: EconomyServicesResponse | undefined;
  isLoading: boolean;
  hasError: boolean;
  onBack: () => void;
}

export function MarketSectionView({
  section,
  generalStore,
  services,
  isLoading,
  hasError,
  onBack,
}: MarketSectionViewProps): React.ReactElement {
  return (
    <div className={styles.sectionView}>
      <div className={styles.sectionHeader}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          ← Torna allo scaffale
        </button>
        <h3 className={styles.sectionTitle}>{SECTION_TITLES[section]}</h3>
      </div>

      {isLoading && <p className={styles.emptyState}>Caricamento del mercato in corso…</p>}
      {hasError && <p className={styles.modalWarning}>⚠️ Errore nel caricamento del mercato. Riprova più tardi.</p>}

      {!isLoading && !hasError && section === 'servizi' && services && <MarketServicesTab data={services} />}
      {!isLoading && !hasError && section !== 'servizi' && generalStore && (
        <MarketItemsTab data={generalStore} section={section} />
      )}
    </div>
  );
}
