import { api } from './client';

export interface ModerationAlertRecord {
  _id: string;
  chatId: string;
  characterId: string;
  characterName: string;
  locationId: string;
  locationName?: string;
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
  status?: string;
  characterId?: string;
  minScore?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface ModerationAlertListResponse {
  items: ModerationAlertRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export const moderationAPI = {
  getAlerts: async (filters: ModerationAlertFilters = {}): Promise<ModerationAlertListResponse> => {
    const response = await api.get('/admin/moderation/alerts', { params: filters });
    return response as any;
  },

  getAlertById: async (id: string): Promise<ModerationAlertRecord> => {
    const response = await api.get(`/admin/moderation/alerts/${id}`);
    return (response as any).data;
  },

  getStats: async (): Promise<ModerationAlertStats> => {
    const response = await api.get('/admin/moderation/alerts/stats');
    return (response as any).data;
  },

  reviewAlert: async (id: string, data: { status: string; reviewNotes?: string; actionTaken?: string }): Promise<ModerationAlertRecord> => {
    const response = await api.patch(`/admin/moderation/alerts/${id}/review`, data);
    return (response as any).data?.alert;
  },
};
