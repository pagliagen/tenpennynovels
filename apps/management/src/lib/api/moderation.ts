import { api } from './client';

export interface ModerationAlertRecord {
  _id: string;
  source: 'chat' | 'forum';
  chatId?: string;
  forumPostId?: string;
  characterId: string;
  characterName: string;
  locationId?: string;
  locationName?: string;
  locationSlug?: string;
  topicSlug?: string;
  discussionSlug?: string;
  content: string;
  toxicityScore: number;
  moderationLabel: string;
  moderationModel: string;
  status: 'pending' | 'reviewed' | 'dismissed' | 'actioned';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  actionTaken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModerationAlertStats {
  pending: number;
  reviewed: number;
  dismissed: number;
  actioned: number;
  total: number;
}

export interface ModerationAlertFilters {
  page?: number;
  limit?: number;
  source?: 'chat' | 'forum';
  status?: string;
  characterId?: string;
  minScore?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface ModerationAlertListResponse {
  list: ModerationAlertRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/** GET /alerts restituisce lista in chiaro (non dentro `data`). */
type ModerationAlertsListHttp = ModerationAlertListResponse & { success: boolean };

export const moderationAPI = {
  getAlerts: async (filters: ModerationAlertFilters = {}): Promise<ModerationAlertListResponse> => {
    const body = (await api.get('/admin/moderation/alerts', { params: filters })) as ModerationAlertsListHttp;
    return { list: body.list, pagination: body.pagination };
  },

  getAlertById: async (id: string): Promise<ModerationAlertRecord> => {
    const body = (await api.get(`/admin/moderation/alerts/${id}`)) as {
      success: boolean;
      data?: ModerationAlertRecord;
    };
    const alert = body.data;
    if (!alert) {
      throw new Error('Alert non trovato');
    }
    return alert;
  },

  getStats: async (source?: 'chat' | 'forum'): Promise<ModerationAlertStats> => {
    const body = (await api.get('/admin/moderation/alerts/stats', {
      params: source ? { source } : {},
    })) as { success: boolean; data?: ModerationAlertStats };
    const stats = body.data;
    if (!stats) {
      throw new Error('Statistiche moderazione non disponibili');
    }
    return stats;
  },

  reviewAlert: async (
    id: string,
    data: { status: string; reviewNotes?: string; actionTaken?: string }
  ): Promise<ModerationAlertRecord> => {
    const body = (await api.patch(`/admin/moderation/alerts/${id}/review`, data)) as {
      success: boolean;
      data?: { message?: string; alert?: ModerationAlertRecord };
    };
    const alert = body.data?.alert;
    if (!alert) {
      throw new Error('Risposta review alert non valida');
    }
    return alert;
  },
};
