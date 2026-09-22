export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface CurrentUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  phone: string | null;
  access_level: AccessLevel;
  region_id: number | null;
  region_name: string | null;
  district_id: number | null;
  district_name: string | null;
  branch_id: number | null;
  branch_name: string | null;
  is_active: boolean;
  last_login: string | null;
  role: string | null;
}

export type AccessLevel = 'HEAD_OFFICE' | 'REGION' | 'DISTRICT' | 'BRANCH';

export interface AuthState {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
