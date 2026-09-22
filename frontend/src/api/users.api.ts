import apiClient from './client';

export interface UserListItem {
  id: number; username: string; full_name: string; email: string; phone: string | null;
  access_level: string; region_id: number | null; region_name: string | null;
  district_id: number | null; district_name: string | null;
  branch_id: number | null; branch_name: string | null;
  is_active: boolean; last_login: string | null; role: string | null;
  failed_login_attempts: number; locked_until: string | null;
}
export interface UserCreate {
  username: string; full_name: string; email: string; phone?: string; password: string;
  access_level: string; region_id?: number | null; district_id?: number | null;
  branch_id?: number | null; role_id: number; is_active?: boolean;
}
export interface UserUpdate {
  full_name?: string; email?: string; phone?: string; access_level?: string;
  region_id?: number | null; district_id?: number | null; branch_id?: number | null; role_id?: number;
}

export const usersApi = {
  list: (params?: { page?: number; page_size?: number; search?: string; access_level?: string; is_active?: boolean }) =>
    apiClient.get('/users', { params }).then(r => r.data as { items: UserListItem[]; total: number; page: number; page_size: number }),
  get: (id: number) => apiClient.get<UserListItem>(`/users/${id}`).then(r => r.data),
  create: (data: UserCreate) => apiClient.post<UserListItem>('/users', data).then(r => r.data),
  update: (id: number, data: UserUpdate) => apiClient.put<UserListItem>(`/users/${id}`, data).then(r => r.data),
  setStatus: (id: number, isActive: boolean) => apiClient.patch(`/users/${id}/status`, { is_active: isActive }).then(r => r.data),
};
