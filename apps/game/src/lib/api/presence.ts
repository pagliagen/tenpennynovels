/**
 * Presence API Client
 *
 * Stato del proprio personaggio nei Presenti (disponibilità a giocare + motivazione).
 *
 * @module lib/api/presence
 */

import { api } from './client';

export interface PresenceStatus {
  /** true = disponibile a giocare */
  availableToPlay: boolean;
  /** Motivazione libera (testo semplice, max 80 caratteri; può essere vuota) */
  reason: string;
}

export const MAX_PRESENCE_REASON_LENGTH = 80;

export const presenceApi = {
  /** PATCH /game/presence/status - cambia lo stato del personaggio della sessione */
  async updateStatus(status: PresenceStatus): Promise<PresenceStatus> {
    const response = await api.patch<{
      success: boolean;
      data: { characterId: string; status: PresenceStatus };
    }>('/game/presence/status', status);
    return response.data.status;
  },
};
