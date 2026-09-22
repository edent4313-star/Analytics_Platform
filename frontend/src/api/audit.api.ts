import apiClient from './client';

export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  status: string;
  ip_address: string | null;
  created_at: string;
}

export const auditApi = {
  list: async (page = 1, pageSize = 50, userId?: number, action?: string) => {
    const { data } = await apiClient.get('/audit-logs', {
      params: { page, page_size: pageSize, user_id: userId, action },
    });
    return data;
  },
};
