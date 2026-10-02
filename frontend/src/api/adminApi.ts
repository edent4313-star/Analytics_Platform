/**
 * Admin API client — Spec 08.
 * All endpoints require admin permissions. Used only by admin pages.
 */
import apiClient from './client';

const BASE = '/admin';

export const adminApi = {
  // AD user lookup (for auto-populating Full Name from email)
  lookupADUser: (email: string) =>
    apiClient.get(`${BASE}/ad/lookup`, { params: { email } }).then(r => r.data as {
      found: boolean; email: string;
      employee_id?: string; full_name?: string;
      department?: string; position?: string;
    }),

  // Users
  listUsers: (params?: Record<string, unknown>) => apiClient.get(`${BASE}/users`, { params }).then(r => r.data),
  getUser: (id: number) => apiClient.get(`${BASE}/users/${id}`).then(r => r.data),
  createUser: (data: Record<string, unknown>) => apiClient.post(`${BASE}/users`, data).then(r => r.data),
  updateUser: (id: number, data: Record<string, unknown>) => apiClient.put(`${BASE}/users/${id}`, data).then(r => r.data),
  setUserStatus: (id: number, isActive: boolean) => apiClient.patch(`${BASE}/users/${id}/status`, { is_active: isActive }).then(r => r.data),
  getUserScope: (id: number) => apiClient.get(`${BASE}/users/${id}/scope`).then(r => r.data),
  updateUserScope: (id: number, data: Record<string, unknown>) => apiClient.put(`${BASE}/users/${id}/scope`, data).then(r => r.data),
  getUserPermissions: (id: number) => apiClient.get(`${BASE}/users/${id}/permissions`).then(r => r.data),

  // Roles
  listRoles: () => apiClient.get(`${BASE}/roles`).then(r => r.data),
  createRole: (data: Record<string, unknown>) => apiClient.post(`${BASE}/roles`, data).then(r => r.data),
  updateRole: (id: number, data: Record<string, unknown>) => apiClient.put(`${BASE}/roles/${id}`, data).then(r => r.data),
  deleteRole: (id: number) => apiClient.delete(`${BASE}/roles/${id}`),
  setRolePermissions: (roleId: number, permissionIds: number[]) =>
    apiClient.put(`${BASE}/roles/${roleId}/permissions`, { permission_ids: permissionIds }).then(r => r.data),

  // Permissions
  listPermissions: () => apiClient.get(`${BASE}/permissions`).then(r => r.data),
  createPermission: (data: Record<string, unknown>) => apiClient.post(`${BASE}/permissions`, data).then(r => r.data),
  updatePermission: (id: number, data: Record<string, unknown>) => apiClient.put(`${BASE}/permissions/${id}`, data).then(r => r.data),
  deletePermission: (id: number) => apiClient.delete(`${BASE}/permissions/${id}`),

  // Departments
  listDepartments: () => apiClient.get(`${BASE}/departments`).then(r => r.data),
  createDepartment: (data: Record<string, unknown>) => apiClient.post(`${BASE}/departments`, data).then(r => r.data),
  updateDepartment: (id: number, data: Record<string, unknown>) => apiClient.put(`${BASE}/departments/${id}`, data).then(r => r.data),

  // Positions
  listPositions: () => apiClient.get(`${BASE}/positions`).then(r => r.data),
  createPosition: (data: Record<string, unknown>) => apiClient.post(`${BASE}/positions`, data).then(r => r.data),
  updatePosition: (id: number, data: Record<string, unknown>) => apiClient.put(`${BASE}/positions/${id}`, data).then(r => r.data),

  // Organizations
  getOrgTree: () => apiClient.get(`${BASE}/organizations`).then(r => r.data),
  listRegions: () => apiClient.get(`${BASE}/regions`).then(r => r.data),
  listDistricts: (regionId?: number) => apiClient.get(`${BASE}/districts`, { params: { region_id: regionId } }).then(r => r.data),
  listBranches: (districtId?: number, regionId?: number) =>
    apiClient.get(`${BASE}/branches`, { params: { district_id: districtId, region_id: regionId } }).then(r => r.data),

  // Dashboard permissions
  listDashboardPermissions: (dashboardId?: number, roleId?: number) =>
    apiClient.get(`${BASE}/dashboard-permissions`, { params: { dashboard_id: dashboardId, role_id: roleId } }).then(r => r.data),
  createDashboardPermission: (data: Record<string, unknown>) => apiClient.post(`${BASE}/dashboard-permissions`, data).then(r => r.data),
  updateDashboardPermission: (id: number, data: Record<string, unknown>) => apiClient.put(`${BASE}/dashboard-permissions/${id}`, data).then(r => r.data),
  deleteDashboardPermission: (id: number) => apiClient.delete(`${BASE}/dashboard-permissions/${id}`),

  // Audit
  listAudit: (params?: Record<string, unknown>) => apiClient.get('/audit', { params }).then(r => r.data),
  getAudit: (id: number) => apiClient.get(`/audit/${id}`).then(r => r.data),
  getUserAudit: (userId: number, params?: Record<string, unknown>) => apiClient.get(`/audit/users/${userId}`, { params }).then(r => r.data),
  getDashboardAudit: (dashboardId: number) => apiClient.get(`/audit/dashboards/${dashboardId}`).then(r => r.data),
  getSecurityEvents: (params?: Record<string, unknown>) => apiClient.get('/audit/security-events', { params }).then(r => r.data),
};
