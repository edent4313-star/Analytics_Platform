import apiClient from './client';

export interface Role { id: number; name: string; display_name: string; description: string | null; is_system: boolean; is_active: boolean; }
export interface Permission { id: number; code: string; name: string; description: string | null; category: string; }

export const rolesApi = {
  list: () => apiClient.get<Role[]>('/roles').then(r => r.data),
  create: (data: { name: string; display_name: string; description?: string }) => apiClient.post<Role>('/roles', data).then(r => r.data),
  update: (id: number, data: { name: string; display_name: string; description?: string }) => apiClient.put<Role>(`/roles/${id}`, data).then(r => r.data),
  getPermissions: (roleId: number) => apiClient.get<Permission[]>(`/roles/${roleId}/permissions`).then(r => r.data),
  setPermissions: (roleId: number, permissionIds: number[]) => apiClient.put(`/roles/${roleId}/permissions`, { permission_ids: permissionIds }).then(r => r.data),
};

export const permissionsApi = {
  list: () => apiClient.get<Permission[]>('/permissions').then(r => r.data),
};
