/**
 * authApi — typed client for all authentication + identity endpoints.
 * Spec 02: replaces the old auth.api.ts (kept for backward compat).
 */
import apiClient from './client';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  provider: string;
}

export interface AuthenticatedIdentity {
  employee_id: string;
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  access_level: 'HEAD_OFFICE' | 'REGION' | 'DISTRICT' | 'BRANCH';
  region_id: number | null;
  region_name: string | null;
  district_id: number | null;
  district_name: string | null;
  branch_id: number | null;
  branch_name: string | null;
  position: string | null;
  department: string | null;
  is_active: boolean;
  last_login: string | null;
  provider: 'mock' | 'cbe_ad';
}

export interface DataScopeResponse {
  access_level: string;
  region_id: number | null;
  region_name: string | null;
  district_id: number | null;
  district_name: string | null;
  branch_id: number | null;
  branch_name: string | null;
  department_scope: string[];
  is_head_office: boolean;
}

export interface SessionInfo {
  user_id: number;
  employee_id: string;
  username: string;
  full_name: string;
  role: string;
  provider: string;
  is_active: boolean;
  last_login: string | null;
}

export const authApi = {
  /** Mock AD login (development only). Use employee_id e.g. "CBE003" */
  login: (employeeId: string, password: string): Promise<TokenResponse> =>
    apiClient.post('/auth/login', { employee_id: employeeId, password }).then(r => r.data),

  /** Initiate CBE OIDC login — navigates browser to CBE IdP (production) */
  initiateADLogin: (): void => {
    window.location.href = '/api/v1/auth/ad/login';
  },

  logout: (): Promise<void> =>
    apiClient.post('/auth/logout').then(() => undefined),

  /** Full identity including position, department, org names */
  getCurrentUser: (): Promise<AuthenticatedIdentity> =>
    apiClient.get('/auth/me').then(r => r.data),

  /** All permission codes for this user */
  getPermissions: (): Promise<{ permissions: string[] }> =>
    apiClient.get('/auth/permissions').then(r => r.data),

  /** Trusted org + department scope — use to configure filter UIs */
  getDataScope: (): Promise<DataScopeResponse> =>
    apiClient.get('/users/me/data-scope').then(r => r.data),

  /** Session metadata */
  getSession: (): Promise<SessionInfo> =>
    apiClient.get('/auth/session').then(r => r.data),

  /** Issue new access token from refresh token */
  refreshSession: (refreshToken: string): Promise<TokenResponse> =>
    apiClient.post('/auth/refresh', { refresh_token: refreshToken }).then(r => r.data),

  changePassword: (currentPassword: string, newPassword: string): Promise<void> =>
    apiClient.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    }).then(() => undefined),

  resetPassword: (userId: number, newPassword: string): Promise<void> =>
    apiClient.post(`/auth/reset-password/${userId}`, { new_password: newPassword }).then(() => undefined),

  unlockUser: (userId: number): Promise<void> =>
    apiClient.post(`/auth/unlock/${userId}`).then(() => undefined),
};

// Backward-compat re-export so existing imports keep working
export default authApi;
