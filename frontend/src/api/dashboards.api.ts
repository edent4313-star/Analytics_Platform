import apiClient from './client';
import type { ActiveFilters } from '@/types/dashboard.types';

export const dashboardsApi = {
  list: (params?: { page?: number; page_size?: number; search?: string }) =>
    apiClient.get('/dashboards', { params }).then(r => r.data),
  get: (id: number) => apiClient.get(`/dashboards/${id}`).then(r => r.data),
  create: (data: { code: string; name: string; description?: string }) =>
    apiClient.post('/dashboards', data).then(r => r.data),
  listVersions: (dashboardId: number) =>
    apiClient.get(`/dashboards/${dashboardId}/versions`).then(r => r.data),
  getVersion: (dashboardId: number, versionId: number) =>
    apiClient.get(`/dashboards/${dashboardId}/versions/${versionId}`).then(r => r.data),
  saveVersion: (dashboardId: number, versionId: number, data: object) =>
    apiClient.put(`/dashboards/${dashboardId}/versions/${versionId}`, data).then(r => r.data),
  submit: (dashboardId: number) =>
    apiClient.post(`/dashboards/${dashboardId}/submit`).then(r => r.data),
  approve: (dashboardId: number) =>
    apiClient.post(`/dashboards/${dashboardId}/approve`).then(r => r.data),
  reject: (dashboardId: number, reason: string) =>
    apiClient.post(`/dashboards/${dashboardId}/reject`, { rejection_reason: reason }).then(r => r.data),
  publish: (dashboardId: number) =>
    apiClient.post(`/dashboards/${dashboardId}/publish`).then(r => r.data),
  unpublish: (dashboardId: number) =>
    apiClient.post(`/dashboards/${dashboardId}/unpublish`).then(r => r.data),
  duplicate: (dashboardId: number) =>
    apiClient.post(`/dashboards/${dashboardId}/duplicate`).then(r => r.data),
  setPermissions: (dashboardId: number, perms: object[]) =>
    apiClient.put(`/dashboards/${dashboardId}/permissions`, perms).then(r => r.data),
  getConfig: (code: string) =>
    apiClient.get(`/dashboard/${code}`).then(r => r.data),
  getWidgetData: (code: string, widgetId: number, filters: ActiveFilters = {}, page = 1, pageSize = 25) =>
    apiClient.get(`/dashboard/${code}/widgets/${widgetId}/data`, {
      params: { page, page_size: pageSize, ...filters },
    }).then(r => r.data),
  exportWidget: (code: string, widgetId: number, format: 'csv' | 'excel' | 'pdf', filters: ActiveFilters = {}) =>
    apiClient.get(`/dashboard/${code}/widgets/${widgetId}/export`, {
      params: { format, ...filters }, responseType: 'blob',
    }),
};
