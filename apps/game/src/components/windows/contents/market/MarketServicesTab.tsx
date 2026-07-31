/**
 * MarketServicesTab — "Servizi" tab: continuative services (servitù,
 * comunicazioni, trasporti, sicurezza), budgeted against Valore di Credito.
 */

import React, { useMemo, useState } from 'react';

import { useSubscribeService, useUnsubscribeService } from '@/hooks/useEconomyServices';
import { useUIStore } from '@/store/uiStore';
import type { EconomyServiceCatalogEntry, EconomyServicesResponse, ServiceCategory } from '@/types/economy';

import styles from '@/styles/components/windows/market/Market.module.scss';

interface MarketServicesTabProps {
  data: EconomyServicesResponse;
}

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  servitu: 'Servitù domestica',
  comunicazioni: 'Comunicazioni e impianti',
  trasporti: 'Trasporti privati',
  sicurezza: 'Sicurezza dell\'abitazione',
};

function findActiveEntry(data: EconomyServicesResponse, serviceId: string, propertyIndex?: number) {
  return data.activeServices.find(
    (entry) => entry.serviceId === serviceId && entry.propertyIndex === propertyIndex && !entry.cancelledAt
  );
}

export function MarketServicesTab({ data }: MarketServicesTabProps): React.ReactElement {
  const [propertySelection, setPropertySelection] = useState<Record<string, number>>({});

  const subscribeService = useSubscribeService();
  const unsubscribeService = useUnsubscribeService();
  const addToast = useUIStore((s) => s.addToast);

  const grouped = useMemo(() => {
    const byCategory: Record<string, EconomyServiceCatalogEntry[]> = {};
    for (const service of data.catalog) {
      (byCategory[service.category] ||= []).push(service);
    }
    return byCategory;
  }, [data.catalog]);

  const handleSubscribe = async (service: EconomyServiceCatalogEntry) => {
    const propertyIndex = service.category === 'sicurezza' ? propertySelection[service._id] : undefined;
    if (service.category === 'sicurezza' && propertyIndex === undefined) {
      addToast({ type: 'error', message: 'Seleziona una proprietà prima di sottoscrivere', duration: 3000 });
      return;
    }
    try {
      await subscribeService.mutateAsync({ serviceId: service._id, propertyIndex });
      addToast({ type: 'success', message: `${service.name} sottoscritto`, duration: 3000 });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Sottoscrizione non riuscita',
        duration: 4000,
      });
    }
  };

  const handleUnsubscribe = async (service: EconomyServiceCatalogEntry, propertyIndex?: number) => {
    try {
      await unsubscribeService.mutateAsync({ serviceId: service._id, propertyIndex });
      addToast({ type: 'success', message: `${service.name} disdetto — punti liberi a fine mese`, duration: 3000 });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Disdetta non riuscita',
        duration: 4000,
      });
    }
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.vcSummary}>
        <span>Valore di Credito: {data.capacity}</span>
        <span>Impegnato: {data.committedTotal}</span>
        <span>Disponibile: {data.available}</span>
      </div>

      {Object.entries(grouped).map(([category, services]) => (
        <div key={category} className={styles.serviceCategoryGroup}>
          <h3 className={styles.serviceCategoryTitle}>{CATEGORY_LABELS[category as ServiceCategory] || category}</h3>

          {services.map((service) => {
            const isSicurezza = service.category === 'sicurezza';
            const propertyIndex = isSicurezza ? propertySelection[service._id] : undefined;
            const activeEntry = findActiveEntry(data, service._id, propertyIndex);
            const isActive = isSicurezza
              ? !!activeEntry
              : data.activeServices.some((entry) => entry.serviceId === service._id && !entry.cancelledAt);

            return (
              <div key={service._id} className={styles.serviceRow}>
                <div>
                  <span className={styles.serviceName}>{service.name}</span>
                  <span className={styles.serviceCost}>{service.monthlyCost} VC/mese</span>
                  <p className={styles.itemDescription}>{service.description}</p>
                </div>

                {isSicurezza && !isActive && (
                  data.properties.length === 0 ? (
                    <p className={styles.modalWarning}>Nessuna proprietà disponibile</p>
                  ) : (
                    <select
                      className={styles.select}
                      value={propertyIndex ?? ''}
                      onChange={(e) =>
                        setPropertySelection((prev) => ({ ...prev, [service._id]: Number(e.target.value) }))
                      }
                    >
                      <option value="">Seleziona proprietà…</option>
                      {data.properties.map((property) => (
                        <option key={property.index} value={property.index}>{property.name}</option>
                      ))}
                    </select>
                  )
                )}

                {isActive ? (
                  <button
                    className={styles.secondaryButton}
                    disabled={unsubscribeService.isPending}
                    onClick={() => handleUnsubscribe(service, propertyIndex)}
                  >
                    Disdici
                  </button>
                ) : (
                  <button
                    className={styles.primaryButton}
                    disabled={
                      !service.canSubscribe ||
                      subscribeService.isPending ||
                      (isSicurezza && (data.properties.length === 0 || propertyIndex === undefined))
                    }
                    onClick={() => handleSubscribe(service)}
                  >
                    Sottoscrivi
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
