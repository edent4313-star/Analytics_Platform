import apiClient from './client';
import type { LoginRequest, TokenResponse, CurrentUser } from '@/types/auth.types';

export const authApi = {
  login: async (credentials: LoginRequest): Promise<TokenResponse> => {
    const { data } = await apiClient.post<TokenResponse>('/auth/login', credentials);
    return data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  me: async (): Promise<CurrentUser> => {
    const { data } = await apiClient.get<CurrentUser>('/auth/me');
    return data;
  },

  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    const { data } = await apiClient.post<TokenResponse>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    return data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await apiClient.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },

  resetPassword: async (userId: number, newPassword: string): Promise<void> => {
    await apiClient.post(`/auth/reset-password/${userId}`, { new_password: newPassword });
  },

  unlockUser: async (userId: number): Promise<void> => {
    await apiClient.post(`/auth/unlock/${userId}`);
  },
};
