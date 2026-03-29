import { apiClient } from './client';

// OnGame Mail API
export const onGameMailApi = {
  async getMessages(params: {
    page: number;
    limit: number;
    search?: string;
    messageType?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const response = await apiClient.get('/admin/mail/ongame', { params });
    return response.data;
  },

  async getStats() {
    const response = await apiClient.get('/admin/mail/ongame/stats');
    return response.data;
  },

  async getMessage(id: string) {
    const response = await apiClient.get(`/admin/mail/ongame/${id}`);
    return response.data;
  },

  async hardDelete(id: string, reason: string) {
    const response = await apiClient.delete(`/admin/mail/ongame/${id}/hard`, {
      data: { reason }
    });
    return response.data;
  },

  async softDelete(id: string) {
    const response = await apiClient.post(`/admin/mail/ongame/${id}/soft-delete`);
    return response.data;
  },

  async bulkDelete(messageIds: string[], deleteType: 'hard' | 'soft', reason?: string) {
    const response = await apiClient.post('/admin/mail/ongame/bulk-delete', {
      messageIds,
      deleteType,
      reason
    });
    return response.data;
  }
};

// OffGame Mail API
export const offGameMailApi = {
  async getMessages(params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const response = await apiClient.get('/admin/mail/offgame', { params });
    return response.data;
  },

  async getStats() {
    const response = await apiClient.get('/admin/mail/offgame/stats');
    return response.data;
  },

  async getMessage(id: string) {
    const response = await apiClient.get(`/admin/mail/offgame/${id}`);
    return response.data;
  },

  async hardDelete(id: string, reason: string) {
    const response = await apiClient.delete(`/admin/mail/offgame/${id}/hard`, {
      data: { reason }
    });
    return response.data;
  },

  async softDelete(id: string) {
    const response = await apiClient.post(`/admin/mail/offgame/${id}/soft-delete`);
    return response.data;
  },

  async bulkDelete(messageIds: string[], deleteType: 'hard' | 'soft', reason?: string) {
    const response = await apiClient.post('/admin/mail/offgame/bulk-delete', {
      messageIds,
      deleteType,
      reason
    });
    return response.data;
  }
};
