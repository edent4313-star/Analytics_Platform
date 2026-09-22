import type { AccessLevel } from './auth.types';

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  phone: string | null;
  access_level: AccessLevel;
  region_id: number | null;
  district_id: number | null;
  branch_id: number | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
  role: string | null;
}

export interface CreateUserRequest {
  username: string;
  full_name: string;
  email: string;
  phone?: string;
  password: string;
  access_level: AccessLevel;
  region_id?: number | null;
  district_id?: number | null;
  branch_id?: number | null;
  role_id: number;
  is_active?: boolean;
}

export interface UpdateUserRequest extends Partial<Omit<CreateUserRequest, 'password'>> {
  password?: string;
}
