/**
 * Economy API Service
 *
 * Handles all HTTP API calls for the Mercato (general-store catalog +
 * continuative services). Uses the singleton apiClient for consistent
 * auth and error handling.
 *
 * **Endpoints**:
 * - GET  /game/economy/general-store
 * - POST /game/economy/general-store/:itemId/purchase
 * - GET  /game/economy/services
 * - POST /game/economy/services/:serviceId/subscribe
 * - POST /game/economy/services/:serviceId/unsubscribe
 *
 * @module lib/api/economy
 */

import type {
  GeneralStoreResponse,
  PurchaseResponse,
  PaymentMethod,
  EconomyServicesResponse,
} from '@/types/economy';

import { api } from './client';

export const economyApi = {
  async getGeneralStore(): Promise<GeneralStoreResponse> {
    const response = await api.get<{ data: GeneralStoreResponse }>('/game/economy/general-store');
    return response.data;
  },

  async purchaseItem(itemId: string, paymentMethod: PaymentMethod): Promise<PurchaseResponse> {
    const response = await api.post<{ data: PurchaseResponse }>(
      `/game/economy/general-store/${itemId}/purchase`,
      { paymentMethod }
    );
    return response.data;
  },

  async getServices(): Promise<EconomyServicesResponse> {
    const response = await api.get<{ data: EconomyServicesResponse }>('/game/economy/services');
    return response.data;
  },

  // subscribe/unsubscribe return only a partial ack (activeServices / cancelledAt+pointsFreeAt),
  // not the full catalog response — the query cache is what the UI reads from (optimistic +
  // rollback in the hooks below), these calls are fire-and-confirm.
  async subscribeService(serviceId: string, propertyIndex?: number): Promise<void> {
    await api.post(`/game/economy/services/${serviceId}/subscribe`, { propertyIndex });
  },

  async unsubscribeService(serviceId: string, propertyIndex?: number): Promise<void> {
    await api.post(`/game/economy/services/${serviceId}/unsubscribe`, { propertyIndex });
  },
};
