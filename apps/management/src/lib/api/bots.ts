import { apiClient } from './client';

export interface BotGenerateParams {
  name?: string;
  description: string;
  locationId?: string;
  locationName?: string;
  locationDescription?: string;
}

export interface BotRefineParams {
  name?: string;
  publicDescription?: string;
  personality?: {
    traits?: string[];
    speech_style?: string;
    background?: string;
    coreValues?: string[];
  };
  systemPrompt?: string;
  narrativeStyle?: {
    author?: string;
    guidance?: string;
  };
}

export interface BotConfirmParams {
  botData: Record<string, any>;
  locationId: string;
}

export interface BotUpdateParams {
  name?: string;
  gender?: string;
  publicDescription?: string;
  personality?: {
    traits?: string[];
    speech_style?: string;
    background?: string;
    coreValues?: string[];
  };
  systemPrompt?: string;
  narrativeStyle?: {
    author?: string;
    guidance?: string;
  } | null;
}

export const botsApi = {
  /** Lista bot attivi con info Character/Location */
  list: async (): Promise<any[]> => {
    const { data } = await apiClient.get('/admin/bots/list');
    return data.data;
  },

  /** Dettaglio bot completo: bot + relazioni + memorie + character info */
  getDetail: async (localAiBotId: string): Promise<any> => {
    const { data } = await apiClient.get(`/admin/bots/${localAiBotId}/detail`);
    return data.data;
  },

  /** Aggiorna campi del bot (personalità, prompt, ecc.) */
  update: async (localAiBotId: string, params: BotUpdateParams): Promise<any> => {
    const { data } = await apiClient.put(`/admin/bots/${localAiBotId}/update`, params);
    return data.data;
  },

  /** Cambia la location del bot */
  changeLocation: async (localAiBotId: string, locationId: string): Promise<any> => {
    const { data } = await apiClient.put(`/admin/bots/${localAiBotId}/location`, { locationId });
    return data.data;
  },

  /** Memorie del bot con un personaggio specifico */
  getCharacterMemories: async (localAiBotId: string, characterId: string): Promise<any[]> => {
    const { data } = await apiClient.get(`/admin/bots/${localAiBotId}/memories/${characterId}`);
    return data.data;
  },

  /**
   * Genera il bot (sincrono). Risponde con { localAiBotId, bot } quando local-ai ha finito.
   * Timeout lato server: 120s.
   */
  generate: async (params: BotGenerateParams): Promise<{ localAiBotId: string; bot: Record<string, any> }> => {
    const { data } = await apiClient.post('/admin/bots/generate', params, { timeout: 130_000 });
    return data.data;
  },

  /**
   * Aggiorna il bot su local-ai (sincrono).
   */
  refine: async (localAiBotId: string, params: BotRefineParams): Promise<{ bot: Record<string, any> }> => {
    const { data } = await apiClient.put(`/admin/bots/${localAiBotId}/refine`, params);
    return data.data;
  },

  /**
   * Conferma la location e genera il personaggio (sincrono).
   * Risponde con { characterId, localAiBotId, locationId } quando tutto è creato.
   * Timeout lato server: 300s.
   */
  confirm: async (localAiBotId: string, params: BotConfirmParams): Promise<{ characterId: string; localAiBotId: string; locationId: string }> => {
    const { data } = await apiClient.post(`/admin/bots/${localAiBotId}/confirm`, params, { timeout: 330_000 });
    return data.data;
  },

  cancel: async (localAiBotId: string): Promise<void> => {
    await apiClient.delete(`/admin/bots/${localAiBotId}`);
  },
};
