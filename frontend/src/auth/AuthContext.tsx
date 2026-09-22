/**
 * Authentication context.
 * - Stores access + refresh tokens in localStorage
 * - Restores session on mount by calling /auth/me with stored token
 * - Provides login / logout / hasPermission / hasRole helpers
 * - Token refresh is handled automatically by the Axios interceptor in client.ts
 */
import React, { createContext, useCallback, useEffect, useState } from 'react';
import apiClient from '@api/client';
import { authApi } from '@api/auth.api';
import { APP_CONFIG } from '@config/app.config';
import type { CurrentUser, LoginRequest } from '@/types/auth.types';

export interface AuthContextValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  hasRole: (roles: string | string[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);

  /** On mount: if a token exists in storage, fetch the user profile */
  useEffect(() => {
    const token = localStorage.getItem(APP_CONFIG.tokenKey);
    if (!token) {
      setIsLoading(false);
      return;
    }
    authApi.me()
      .then(u => {
        setUser(u);
        // Load real permissions after restoring session
        apiClient.get<{ permissions: string[] }>('/auth/me/permissions')
          .then(r => setPermissions(r.data.permissions))
          .catch(() => {});
      })
      .catch(() => {
        // Token invalid or expired — clear storage, user must log in again
        localStorage.removeItem(APP_CONFIG.tokenKey);
        localStorage.removeItem(APP_CONFIG.refreshTokenKey);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const _loadPermissions = async () => {
    try {
      const { data } = await apiClient.get<{ permissions: string[] }>('/auth/me/permissions');
      setPermissions(data.permissions);
    } catch { /* ignore */ }
  };

  const login = useCallback(async (credentials: LoginRequest) => {
    const tokens = await authApi.login(credentials);
    localStorage.setItem(APP_CONFIG.tokenKey, tokens.access_token);
    localStorage.setItem(APP_CONFIG.refreshTokenKey, tokens.refresh_token);
    const currentUser = await authApi.me();
    setUser(currentUser);
    await _loadPermissions();
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* proceed even if server call fails */ }
    localStorage.removeItem(APP_CONFIG.tokenKey);
    localStorage.removeItem(APP_CONFIG.refreshTokenKey);
    setUser(null);
    setPermissions([]);
  }, []);

  /** Reload user profile (call after profile updates) */
  const refreshUser = useCallback(async () => {
    try {
      const updated = await authApi.me();
      setUser(updated);
    } catch {
      // If refresh fails the Axios interceptor already handles redirect to login
    }
  }, []);

  const hasPermission = useCallback((code: string): boolean => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return permissions.includes(code);
  }, [user, permissions]);

  const hasRole = useCallback((roles: string | string[]): boolean => {
    if (!user?.role) return false;
    return (Array.isArray(roles) ? roles : [roles]).includes(user.role);
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user, isLoading,
      login, logout, refreshUser, hasPermission, hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
